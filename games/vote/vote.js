'use strict';
// 투표: 글 항목·날짜 투표를 만들어 링크(·QR)로 나눠 주면 각자 폰에서 투표하고, 결과가 바로 바뀜
// 하나만·여러 개 고르기, 익명, 다른 사람도 항목 추가, 결과 가리기(투표한 뒤·마감 뒤), 마감 시간
// 표는 Firebase에 모음 (vote-db.js). 누가 무엇을 할 수 있는지는 화면이 아니라 firestore.rules가 지킴
// 주소 # 뒤가 투표 id: 없으면 만들기 화면, 있으면 그 투표
const prefs = store('vote', { name: '', polls: [] }); // 내 이름(이름 투표에 씀), 이 기기에서 만들거나 연 투표 [{ id, title }]
const RECENT_MAX = 20;
const remember = (id, title) => prefs.set({ polls: [{ id, title }, ...prefs.get().polls.filter(p => p.id !== id)].slice(0, RECENT_MAX) });
const forget = id => prefs.set({ polls: prefs.get().polls.filter(p => p.id !== id) });
let view = null; // 지금 보는 투표 (openPoll)

function route() {
  view?.stop();
  view = null;
  const id = location.hash.slice(1);
  $('newBtn').hidden = !id;
  if (!firebaseConfig) $('app').replaceChildren(notReady());
  else if (id) openPoll(id);
  else $('app').replaceChildren(createPanel(), recentPanel());
}
function notReady() {
  const panel = h('section', 'panel vote-panel');
  panel.append(h('h2', '', '🗳️ 아직 준비 중이에요'),
    h('p', 'hint', '투표는 여러 폰의 표를 Firebase에 모아요. 장난감 상자에 Firebase 설정(js/firebase-config.js)을 넣으면 쓸 수 있어요. 방법은 README의 ‘투표 준비’에 있어요.'));
  return panel;
}
function errText(e) {
  const c = e?.code || '';
  if (c === 'auth/operation-not-allowed' || c === 'auth/admin-restricted-operation') return 'Firebase 콘솔에서 익명 로그인을 켜 주세요';
  if (!navigator.onLine || c === 'unavailable' || c === 'auth/network-request-failed' || e instanceof TypeError) return '인터넷 연결을 확인해 주세요';
  if (c === 'permission-denied') return '할 수 없는 일이에요 (마감됐거나, Firebase 규칙이 아직 안 올라갔어요)';
  return `잘 안 됐어요 (${c || e?.message || e})`;
}
function errorPanel(e) {
  const panel = h('section', 'panel vote-panel');
  panel.append(h('h2', '', '연결하지 못했어요'), h('p', 'hint', errText(e)), button('다시 시도', route, 'btn'));
  return panel;
}
const checkbox = (label, on, onChange) => {
  const l = h('label', 'check'), box = h('input');
  box.type = 'checkbox';
  box.checked = on;
  box.addEventListener('change', () => onChange(box.checked));
  l.append(box, h('span', '', label));
  return l;
};
const field = (label, ...els) => { const d = h('div', 'vote-field'); d.append(h('b', '', label), ...els); return d; };

// ---------- 1. 만들기 ----------
// 쓰는 중인 투표 (이 탭에서만 기억). 고르기를 바꾸면 화면을 다시 그리고, 글자는 칸에 그대로 둠 (한글 조합이 안 끊기게)
const DRAFT = { title: '', kind: 'text', items: '', dates: [], multi: false, maxPick: 0, anonymous: false, allowAdd: false, results: 'always', deadline: false, closeAt: '' };
let draft = { ...DRAFT, dates: [] };
const redraw = () => $('app').replaceChildren(createPanel(), recentPanel());
const draftItems = () => (draft.kind === 'text' ? parseItems(draft.items) : draft.dates);
const draftCloseAt = () => (draft.deadline ? (draft.closeAt ? new Date(draft.closeAt).getTime() : NaN) : null); // datetime-local 값은 이 기기 시간
const draftProblem = () => pollProblem({ title: draft.title, items: draftItems(), allowAdd: draft.allowAdd, closeAt: draftCloseAt() }, Date.now());

function createPanel() {
  const panel = h('section', 'panel vote-panel'), info = h('p', 'vote-info'), go = button('🗳️ 투표 만들기', () => create(go), 'btn primary big');
  const check = () => {
    const p = draftProblem(), n = draftItems().length;
    info.textContent = p || `항목 ${n}개`;
    go.disabled = !!p;
  };
  const title = h('input', 'text-input');
  title.maxLength = MAX_TITLE;
  title.placeholder = '예: 이번 주 점심 뭐 먹을까요?';
  title.value = draft.title;
  title.addEventListener('input', () => { draft.title = title.value; check(); });

  const kind = h('div', 'seg');
  for (const [k, label] of [['text', '📝 글 항목'], ['date', '📅 날짜']]) {
    kind.append(button(label, () => { if (draft.kind !== k) { draft.kind = k; draft.multi = k === 'date'; redraw(); } }, draft.kind === k ? 'on' : ''));
  }
  let items;
  if (draft.kind === 'text') {
    items = h('textarea');
    items.rows = 5;
    items.placeholder = '한 줄에 하나씩\n짜장면\n짬뽕';
    items.value = draft.items;
    items.addEventListener('input', () => { draft.items = items.value; check(); });
  } else {
    const list = h('ul', 'vote-dates');
    for (const t of draft.dates) {
      const li = h('li');
      li.append(h('span', '', whenLabel(t)), button('✕', () => { draft.dates = draft.dates.filter(x => x !== t); redraw(); }, 'icon-btn small'));
      list.append(li);
    }
    const c = dateCalendar(() => draft.dates, t => {
      draft.dates = draft.dates.includes(t) ? draft.dates.filter(x => x !== t) : [...draft.dates, t].sort();
      redraw();
    }, '날짜를 누르면 바로 들어가고, 다시 누르면 빠져요. 시간을 정해 두면 그 시간으로 들어가요(같은 날 시간을 바꿔 가며 여러 개).');
    items = h('div', 'vote-field');
    items.append(c.el, list); // 달력이 위: 날짜가 늘어도 달력 자리가 안 밀림
  }

  const pick = h('div', 'vote-sub'), max = h('select', 'text-input vote-select');
  for (const n of [0, 2, 3, 4, 5, 6, 7, 8, 9, 10]) { const o = h('option', '', n ? `${n}개까지` : '제한 없음'); o.value = n; max.append(o); }
  max.value = draft.maxPick;
  max.addEventListener('change', () => { draft.maxPick = +max.value; });
  pick.append(checkbox('여러 개 고르기', draft.multi, v => { draft.multi = v; redraw(); }));
  if (draft.multi) pick.append(max);

  const results = h('div', 'seg');
  for (const [k, label] of [['always', '바로 보기'], ['voted', '투표한 뒤'], ['closed', '마감 뒤']]) {
    results.append(button(label, () => { draft.results = k; redraw(); }, draft.results === k ? 'on' : ''));
  }
  const deadline = h('div', 'vote-sub'), when = h('input', 'text-input vote-when');
  when.type = 'datetime-local';
  if (!draft.closeAt) draft.closeAt = whenOf(Date.now() + 864e5).slice(0, 14).replace(' ', 'T') + '00'; // 기본: 내일 이맘때 정각
  when.value = draft.closeAt;
  when.addEventListener('input', () => { draft.closeAt = when.value; check(); });
  deadline.append(checkbox('⏰ 마감 시간 정하기', draft.deadline, v => { draft.deadline = v; redraw(); }));
  if (draft.deadline) deadline.append(when);

  panel.append(h('h2', '', '새 투표'), field('질문', title), field('항목', kind, items),
    field('고르기', pick, checkbox('🙈 익명 투표', draft.anonymous, v => { draft.anonymous = v; }),
      checkbox('＋ 다른 사람도 항목 추가', draft.allowAdd, v => { draft.allowAdd = v; check(); })),
    field('결과 공개', results, h('p', 'hint', { always: '투표하기 전에도 결과가 보여요.', voted: '자기 표를 낸 사람만 결과를 봐요.', closed: '마감 시간이 되거나 만든 사람이 마감하면 모두에게 공개돼요.' }[draft.results])),
    field('마감', deadline), info, go);
  check();
  return panel;
}
async function create(go) {
  const problem = draftProblem();
  if (problem) return toast(problem);
  go.disabled = true;
  go.textContent = '만드는 중…';
  const title = draft.title.trim();
  try {
    const id = await voteDb.create({ title, kind: draft.kind, maxPick: draft.multi ? draft.maxPick : 1, anonymous: draft.anonymous,
      allowAdd: draft.allowAdd, results: draft.results, closeAt: draftCloseAt() }, draftItems());
    remember(id, title);
    draft = { ...DRAFT, dates: [] };
    location.hash = id;
    toast('투표를 만들었어요. 링크를 나눠 주세요');
  } catch (e) {
    toast(errText(e), 3500);
    go.disabled = false;
    go.textContent = '🗳️ 투표 만들기';
  }
}
function recentPanel() {
  const list = prefs.get().polls;
  if (!list.length) return '';
  const panel = h('section', 'panel vote-panel'), ul = h('ul', 'vote-recent');
  for (const p of list) {
    const li = h('li'), a = h('a', '', p.title), x = button('✕', () => { forget(p.id); redraw(); }, 'icon-btn small');
    a.href = `#${p.id}`;
    x.title = '목록에서 빼기';
    li.append(a, x);
    ul.append(li);
  }
  panel.append(h('h2', '', '이 기기에서 연 투표'), ul, h('p', 'hint', '목록에서 빼도 투표는 그대로예요.'));
  return panel;
}

// 글 항목 넣는 칸: onAdd(글자)가 false를 돌려주면 칸을 그대로 둠
function textAdder(onAdd) {
  const form = h('form', 'vote-adder'), input = h('input', 'text-input'), go = h('button', 'btn', '추가');
  input.maxLength = MAX_TEXT;
  input.placeholder = '새 항목';
  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = input.value.trim();
    if (t && onAdd(t) !== false) input.value = '';
  });
  form.append(input, go);
  return form;
}
// 달력: 날짜를 누르면 바로 onPick(글자). 시간을 정해 두면 'YYYY-MM-DD HH:MM'으로. 지난 날은 못 누름
// picked(): 지금 들어 있는 항목 글자들 → 그 날짜에 표시. 돌려준 redraw()로 표시만 다시
const cal = { month: '', time: '' }; // 보던 달·시간: 화면을 다시 그려도 그대로
function dateCalendar(picked, onPick, hint) {
  const box = h('div', 'cal'), head = h('div', 'cal-head'), title = h('b'), grid = h('div', 'cal-grid'), timeRow = h('div', 'cal-time'), time = h('input', 'text-input');
  const today = whenOf(Date.now()).slice(0, 10), thisMonth = today.slice(0, 7);
  if (!cal.month || cal.month < thisMonth) cal.month = thisMonth;
  const go = k => { cal.month = addMonth(cal.month, k); draw(); };
  const prev = button('‹', () => go(-1), 'icon-btn small'), next = button('›', () => go(1), 'icon-btn small');
  prev.title = '이전 달';
  next.title = '다음 달';
  const clear = button('✕', () => { time.value = cal.time = ''; clear.hidden = true; }, 'icon-btn small');
  clear.title = '시간 빼기';
  time.type = 'time';
  time.value = cal.time;
  time.setAttribute('aria-label', '시간');
  clear.hidden = !cal.time;
  time.addEventListener('input', () => { cal.time = time.value; clear.hidden = !time.value; });
  function draw() {
    const days = new Set(picked().map(t => t.slice(0, 10)));
    title.textContent = `${+cal.month.slice(0, 4)}년 ${+cal.month.slice(5)}월`;
    prev.disabled = cal.month <= thisMonth;
    grid.replaceChildren(...[...WEEK].map((w, i) => h('span', `cal-wd${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`, w)), ...monthDays(cal.month).map((d, i) => {
      if (!d) return h('span');
      const b = button(String(+d.slice(8)), () => onPick(whenText(d, cal.time)),
        `cal-day${days.has(d) ? ' on' : ''}${d === today ? ' today' : ''}${i % 7 === 0 ? ' sun' : i % 7 === 6 ? ' sat' : ''}`);
      b.disabled = d < today;
      b.setAttribute('aria-label', whenLabel(d));
      return b;
    }));
  }
  head.append(prev, title, next);
  timeRow.append(h('span', '', '🕒 시간'), time, clear);
  box.append(head, grid, timeRow, h('p', 'hint', hint));
  draw();
  return { el: box, redraw: draw };
}

// ---------- 2. 투표 보기 ----------
// 투표·항목·내 표는 늘 지켜보고, 모든 표는 결과를 볼 수 있을 때만 지켜봄 (가린 결과는 규칙이 아예 안 보내 줌)
// 화면은 처음 한 번 틀을 만들고(입력 칸은 그대로 두어 다른 사람의 표가 들어와도 쓰던 글자가 안 지워짐), 바뀔 때마다 나머지만 다시 그림
async function openPoll(id) {
  const v = { id, poll: undefined, options: undefined, mine: undefined, votes: null, sel: null, busy: false, denied: 0, timer: 0, w: null, stopVotes: null,
    stop() { this.w?.stop(); this.stopVotes?.(); clearTimeout(this.timer); } };
  view = v;
  $('app').replaceChildren(h('p', 'vote-wait', '투표를 불러오는 중…'));
  const fail = e => { if (view !== v) return; v.stop(); view = null; $('app').replaceChildren(errorPanel(e)); };
  try {
    v.w = await voteDb.watch(id, {
      poll: p => { v.poll = p; paint(v); },
      options: o => { v.options = o; paint(v); },
      mine: m => { v.mine = m; paint(v); },
      error: fail,
    });
  } catch (e) { return fail(e); }
  if (view !== v) return v.w.stop(); // 그새 다른 화면으로 감
  paint(v);
}

function paint(v) {
  if (view !== v || !v.w || v.poll === undefined || v.options === undefined || v.mine === undefined) return; // 아직 다 안 옴
  const p = v.poll;
  if (!p) {
    forget(v.id);
    const panel = h('section', 'panel vote-panel');
    panel.append(h('h2', '', '투표가 없어요'), h('p', 'hint', '지워졌거나 링크가 잘못됐어요.'), button('새 투표 만들기', () => { location.hash = ''; }, 'btn'));
    $('app').replaceChildren(panel);
    return;
  }
  if (!v.built) build(v);
  const now = Date.now(), closed = isClosed(p, now), see = canSeeResults(p, !!v.mine, now), lim = pickLimit(p);
  // 모든 표: 볼 수 있게 되면 지켜보기 시작, 못 보게 되면(내 표 취소) 그만
  // 막히면(마감 시간이 막 지났거나 내 표가 아직 서버에 안 들어갔을 때) 연결을 새로 열고 2초 뒤에, 세 번까지 다시
  if (see && !v.stopVotes) {
    v.stopVotes = v.w.watchVotes(list => { v.votes = list; v.denied = 0; paint(v); }, () => {
      v.stopVotes = null;
      v.votes = null;
      if (++v.denied <= 3) setTimeout(() => v.w.reconnect().finally(() => paint(v)), 2000);
    });
  } else if (!see && v.stopVotes) { v.stopVotes(); v.stopVotes = null; v.votes = null; }
  clearTimeout(v.timer); // 마감 시간이 되면 다시 그림
  if (!closed && p.closeAt != null) v.timer = setTimeout(() => paint(v), Math.min(p.closeAt - now + 500, 2 ** 31 - 1));

  // 머리: 질문과 규칙들
  const chips = h('div', 'vote-chips');
  for (const c of [p.kind === 'date' ? '📅 날짜' : '📝 글 항목', p.maxPick === 1 ? '하나만' : p.maxPick ? `${p.maxPick}개까지` : '여러 개',
    p.anonymous && '🙈 익명', p.allowAdd && !closed && '＋ 항목 추가 가능', p.results === 'voted' && '👀 투표하면 결과 공개', p.results === 'closed' && '👀 마감 뒤 결과 공개',
    closed ? '🏁 마감' : p.closeAt != null && `⏰ ${whenLabel(whenOf(p.closeAt), now)} 마감`]) if (c) chips.append(h('span', '', c));
  $('vHead').replaceChildren(h('h2', 'vote-title', p.title), chips);

  // 항목: 누르면 고르기, 결과를 볼 수 있으면 표 수·막대(·이름)
  const ids = new Set(v.options.map(o => o.id)), sel = (v.sel ?? v.mine?.picks ?? []).filter(id => ids.has(id)), t = v.votes && tally(v.options, v.votes);
  const rows = sortOptions(p, v.options).map(o => {
    const on = sel.includes(o.id), r = t?.rows.get(o.id), li = h('li', 'opt-row'), body = h('span', 'opt-body');
    const b = button('', () => { v.sel = togglePick(sel, o.id, lim); paint(v); }, `opt${on ? ' on' : ''}${lim === 1 ? ' one' : ''}${r && t.max && r.count === t.max ? ' top' : ''}`);
    b.disabled = closed || v.busy;
    b.setAttribute('aria-pressed', on);
    body.append(h('span', 'opt-text', optionLabel(p, o, now)));
    if (r?.names.length) body.append(h('small', 'opt-names', r.names.join(', ')));
    b.append(h('span', 'opt-mark'), body);
    if (r) {
      b.append(h('b', 'opt-count', `${r.count}표`));
      b.style.setProperty('--fill', `${t.voters ? (r.count / t.voters) * 100 : 0}%`);
    }
    li.append(b);
    if (p.isOwner && !closed) {
      const x = button('✕', () => removeOption(v, o), 'icon-btn small');
      x.title = '항목 지우기';
      li.append(x);
    }
    return li;
  });
  $('vOpts').replaceChildren(...rows);
  if (!rows.length) $('vOpts').append(h('li', 'hint', '아직 항목이 없어요. 아래에서 넣어 주세요.'));
  $('vAdd').hidden = closed || !(p.allowAdd || p.isOwner) || v.options.length >= MAX_OPTIONS;
  v.cal?.redraw(); // 달력에 들어 있는 날짜 표시
  $('vName').hidden = closed || p.anonymous;

  // 단추와 알림 (한 줄에 하나)
  const btns = h('div', 'play-btns'), notes = [];
  if (closed) notes.push('🏁 마감됐어요.');
  else {
    const go = button(v.mine ? '투표 바꾸기' : '투표하기', () => submit(v, sel), 'btn primary');
    go.disabled = !sel.length || v.busy;
    btns.append(go);
    if (v.mine) btns.append(button('투표 취소', () => unvote(v), 'btn'));
    if (v.mine) notes.push('✓ 투표했어요. 다시 고르고 ‘투표 바꾸기’를 누르면 바뀌어요.');
    if (lim > 1 && lim < Infinity) notes.push(`${lim}개까지 골라요 (지금 ${sel.length}개)`);
  }
  if (!see) notes.push(p.results === 'voted' ? '결과는 투표하면 보여요.' : '결과는 마감 뒤에 보여요.');
  else if (t) notes.push(`${t.voters}명 투표`);
  $('vBtns').replaceChildren(...(closed ? [] : [btns]), h('p', 'vote-status', notes.join('\n')));

  $('vOwner').hidden = !p.isOwner;
  if (p.isOwner) {
    const ob = h('div', 'play-btns');
    ob.append(closed ? button('다시 열기', () => setClosed(v, false), 'btn') : button('🏁 지금 마감', () => setClosed(v, true), 'btn'),
      button('투표 지우기', () => removePoll(v), 'btn'));
    $('vOwner').replaceChildren(h('h2', '', '만든 사람만'), ob,
      h('p', 'hint', '이 기기(브라우저)에서 만든 투표라 마감하고 지울 수 있어요. 엉뚱한 항목은 ✕로 지워요.'));
  }
}
// 틀: 머리 · 항목 · 항목 넣기 · 이름 · 단추 / 나눠 주기 / 만든 사람
function build(v) {
  const p = v.poll, main = h('section', 'panel vote-panel'), add = h('div', 'vote-add'), nameRow = h('div', 'vote-field'), name = h('input', 'text-input');
  const ids = { vHead: h('div', 'vote-head'), vOpts: h('ul', 'opts'), vAdd: add, vName: nameRow, vBtns: h('div', 'vote-btns'), vOwner: h('section', 'panel vote-panel') };
  for (const [id, el] of Object.entries(ids)) el.id = id;
  if (p.kind === 'date') { // 달력은 크니까 눌러야 펼침
    const more = h('details', 'cal-more');
    v.cal = dateCalendar(() => v.options.map(o => o.text), t => addOption(v, t), '날짜를 누르면 바로 들어가요. 시간을 정해 두면 그 시간으로 들어가요.');
    more.append(h('summary', 'btn', '＋ 날짜 넣기'), v.cal.el);
    add.append(more);
  } else add.append(textAdder(t => addOption(v, t)));
  name.id = 'vNameInput';
  name.maxLength = MAX_NAME;
  name.placeholder = '다른 사람에게 보일 이름';
  name.value = v.mine?.name || prefs.get().name;
  nameRow.append(h('b', '', '내 이름'), name);
  main.append(ids.vHead, ids.vOpts, add, nameRow, ids.vBtns);
  $('app').replaceChildren(main, sharePanel(v.id, p.title), ids.vOwner);
  remember(v.id, p.title);
  v.built = true;
}

function addOption(v, text) {
  if (hasItem(v.options, text)) { toast('이미 있는 항목이에요'); return false; }
  voteDb.addOption(v.id, text).catch(e => toast(errText(e), 3500));
}
function removeOption(v, o) {
  if (!confirm(`‘${optionLabel(v.poll, o, Date.now())}’ 항목을 지울까요? 이 항목에 들어간 표는 빠져요.`)) return;
  voteDb.removeOption(v.id, o.id).catch(e => toast(errText(e), 3500));
}
async function submit(v, sel) {
  let name = null;
  if (!v.poll.anonymous) {
    name = $('vNameInput').value.trim();
    if (!name) { toast('이름을 적어 주세요'); $('vNameInput').focus(); return; }
    prefs.set({ name });
  }
  const again = !!v.mine;
  v.busy = true;
  paint(v);
  try {
    await voteDb.vote(v.id, sel, name); // 서버에 들어간 뒤 → '투표한 뒤 공개'면 이제 모든 표를 볼 수 있음
    v.sel = null;
    v.denied = 0;
    toast(again ? '투표를 바꿨어요' : '투표했어요');
  } catch (e) { toast(errText(e), 3500); }
  v.busy = false;
  paint(v);
}
async function unvote(v) {
  v.busy = true;
  paint(v);
  try {
    await voteDb.unvote(v.id);
    v.sel = null;
    toast('투표를 취소했어요');
  } catch (e) { toast(errText(e), 3500); }
  v.busy = false;
  paint(v);
}
function setClosed(v, closed) {
  const p = v.poll, at = p.closeAt != null && p.closeAt <= Date.now() ? null : p.closeAt; // 마감 시간이 지난 투표를 다시 열면 마감 시간은 없앰
  voteDb.setClosed(v.id, closed, closed ? p.closeAt : at).then(() => toast(closed ? '마감했어요' : '다시 열었어요'), e => toast(errText(e), 3500));
}
async function removePoll(v) {
  if (!confirm('이 투표를 지울까요? 표와 항목이 모두 지워지고, 링크를 열어도 ‘투표가 없어요’로 나와요.')) return;
  try {
    view = null; // 지우는 동안 들어오는 변화는 그리지 않음
    v.stop();
    await voteDb.remove(v.id);
    forget(v.id);
    location.hash = '';
    toast('투표를 지웠어요');
  } catch (e) {
    toast(errText(e), 3500);
    route();
  }
}

// ---------- 나눠 주기: 링크 복사 · 공유 · QR ----------
function sharePanel(id, title) {
  const panel = h('section', 'panel vote-panel'), url = `${location.origin}${location.pathname}#${id}`, btns = h('div', 'play-btns');
  btns.append(button('🔗 링크 복사', async () => {
    try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요'); } catch { prompt('링크를 복사해 주세요', url); } // 복사가 안 되는 브라우저
  }, 'btn'));
  if (navigator.share) btns.append(button('공유', () => navigator.share({ title: `🗳️ ${title}`, text: `🗳️ ${title} — 투표해 주세요!`, url }).catch(() => {}), 'btn'));
  btns.append(button('QR', () => showQR(url, title), 'btn'));
  panel.append(h('h2', '', '📣 나눠 주기'), h('p', 'hint', '링크를 단톡방에 올리거나, 큰 화면에 QR을 띄워 폰 카메라로 찍게 해요.'), btns);
  return panel;
}
function showQR(url, title) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount(), m = 4, s = svg('svg', { class: 'qr', viewBox: `0 0 ${n + m * 2} ${n + m * 2}`, 'shape-rendering': 'crispEdges' });
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
  s.append(svg('rect', { width: n + m * 2, height: n + m * 2, fill: '#fff' }), svg('path', { d, fill: '#000' }));
  $('qrTitle').textContent = `🗳️ ${title}`;
  $('qrBox').replaceChildren(s);
  $('qr').showModal();
}
$('qrClose').addEventListener('click', () => $('qr').close());

addEventListener('hashchange', route);
route();
