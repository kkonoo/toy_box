'use strict';
// 포트럭: 카테고리마다 칸(가져올 사람 수)을 정해 링크를 나눠 주면, 각자 폰에서 카테고리를 골라 가져올 메뉴를 신청
// 누가 무엇을 가져오는지 모두에게 바로 보여서 메뉴가 안 겹침. 만든 기기는 마감하면서 아직 안 정한 사람을 남은 칸에 랜덤으로 넣음
// 저장은 Firebase (potluck-db.js), 누가 무엇을 할 수 있는지는 firestore.rules가 지킴. 주소 # 뒤가 포트럭 id
const prefs = store('potluck', { name: '', recent: [], rest: {} }); // 내 이름, 이 기기에서 연 포트럭 [{ id, title }], rest = { 포트럭 id: '아직 안 정한 사람' 칸 글 }
const remember = (id, title) => prefs.set({ recent: [{ id, title }, ...prefs.get().recent.filter(p => p.id !== id)].slice(0, 10) });
const forget = id => prefs.set({ recent: prefs.get().recent.filter(p => p.id !== id) });
let view = null; // 지금 보는 포트럭

function route() {
  view?.stop();
  view = null;
  const id = location.hash.slice(1);
  if (!firebaseConfig) $('app').replaceChildren(note('🍗 아직 준비 중이에요', '포트럭은 신청을 Firebase에 모아요. Firebase 설정(js/firebase-config.js)을 넣으면 쓸 수 있어요.'));
  else if (id) openPotluck(id);
  else { $('app').replaceChildren(createPanel(), recentPanel()); }
}
function note(title, text, ...rest) {
  const panel = h('section', 'panel pot-panel');
  panel.append(h('h2', '', title), h('p', 'hint', text), ...rest);
  return panel;
}
function errText(e) {
  const c = e?.code || '';
  if (c === 'auth/operation-not-allowed' || c === 'auth/admin-restricted-operation') return 'Firebase 콘솔에서 익명 로그인을 켜 주세요';
  if (!navigator.onLine || c === 'unavailable' || c === 'auth/network-request-failed' || e instanceof TypeError) return '인터넷 연결을 확인해 주세요';
  if (c === 'permission-denied') return '할 수 없는 일이에요 (마감됐거나, Firebase 규칙이 아직 안 올라갔어요)';
  return `잘 안 됐어요 (${c || e?.message || e})`;
}

// ---------- 1. 만들기 ----------
const draft = { title: '🎄 크리스마스 포트럭', people: 8, slots: recommendSlots(8) }; // 이 탭에서만 기억
function createPanel() {
  const panel = h('section', 'panel pot-panel'), title = h('input', 'text-input'), cats = h('ul', 'pot-setup'), info = h('p', 'pot-info');
  const go = button('🍗 포트럭 만들기', () => create(go), 'btn primary big');
  title.maxLength = 60;
  title.value = draft.title;
  title.addEventListener('input', () => { draft.title = title.value; go.disabled = !title.value.trim(); });
  const redraw = () => $('app').replaceChildren(createPanel(), recentPanel());
  const people = h('div', 'pot-people');
  people.append(h('b', '', '인원'), stepper(draft.people, 2, 30, v => { draft.people = v; draft.slots = recommendSlots(v); redraw(); }), h('span', 'hint', '바꾸면 칸을 인원에 맞춰 다시 나눠요'));
  POT_CATS.forEach((c, i) => {
    const li = h('li');
    li.append(h('b', '', c.name), stepper(draft.slots[i], 0, 15, v => { draft.slots[i] = v; redraw(); }), h('small', '', `${c.ex.slice(0, 4).join(', ')} 등 ${c.ex.length}가지`));
    cats.append(li);
  });
  const total = draft.slots.reduce((a, b) => a + b, 0);
  info.textContent = `칸 ${total}개 · 한 사람이 한 칸씩${total !== draft.people ? ` (인원 ${draft.people}명)` : ''}`;
  go.disabled = !draft.title.trim() || !total;
  panel.append(h('h2', '', '새 포트럭'), title, people, cats, info, go,
    h('p', 'hint', '만든 뒤 링크를 단톡방에 올리면 각자 카테고리를 골라 가져올 메뉴를 적어요. 마감할 때 아직 안 정한 사람은 남은 칸에 랜덤으로 넣을 수 있어요.'));
  return panel;
}
async function create(go) {
  go.disabled = true;
  go.textContent = '만드는 중…';
  const title = draft.title.trim(), cats = POT_CATS.map((c, i) => ({ name: c.name, slots: draft.slots[i], ex: c.ex.join(', ') }));
  try {
    const id = await potDb.create(title, cats);
    remember(id, title);
    location.hash = id;
    toast('만들었어요. 링크를 단톡방에 올려 주세요');
  } catch (e) {
    toast(errText(e), 3500);
    go.disabled = false;
    go.textContent = '🍗 포트럭 만들기';
  }
}
function recentPanel() {
  const list = prefs.get().recent;
  if (!list.length) return '';
  const ul = h('ul', 'pot-recent');
  for (const p of list) {
    const li = h('li'), a = h('a', '', p.title), x = button('✕', () => { forget(p.id); route(); }, 'icon-btn small');
    a.href = `#${p.id}`;
    x.title = '목록에서 빼기';
    li.append(a, x);
    ul.append(li);
  }
  return note('이 기기에서 연 포트럭', '목록에서 빼도 포트럭은 그대로예요.', ul);
}

// ---------- 2. 신청 보기 ----------
// 입력 칸(이름·메뉴·안 정한 사람)은 한 번만 만들어 두고(build) 바뀐 부분만 다시 그림 → 다른 사람 신청이 들어와도 쓰던 글자가 안 지워짐
async function openPotluck(id) {
  const v = { id, p: undefined, entries: undefined, sel: null, busy: false, w: null, stop() { this.w?.stop(); } };
  v.name = h('input', 'text-input');
  v.name.maxLength = 20;
  v.name.placeholder = '내 이름';
  v.name.value = prefs.get().name;
  v.dish = h('input', 'text-input');
  v.dish.maxLength = 40;
  v.rest = h('textarea');
  v.rest.rows = 4;
  v.rest.placeholder = '한 줄에 한 명씩 (신청한 사람은 알아서 빠져요)';
  v.rest.value = prefs.get().rest[id] || '';
  v.rest.addEventListener('input', () => { prefs.set({ rest: { ...prefs.get().rest, [id]: v.rest.value } }); paint(v); });
  v.dish.addEventListener('input', () => { v.dishTouched = true; });
  view = v;
  $('app').replaceChildren(h('p', 'pot-wait', '불러오는 중…'));
  const fail = e => { if (view !== v) return; v.stop(); view = null; $('app').replaceChildren(note('연결하지 못했어요', errText(e), button('다시 시도', route, 'btn'))); };
  try {
    v.w = await potDb.watch(id, { potluck: p => { v.p = p; paint(v); }, entries: list => { v.entries = list; paint(v); }, error: fail });
  } catch (e) { return fail(e); }
  if (view !== v) v.w.stop();
}

function paint(v) {
  if (view !== v || v.p === undefined || v.entries === undefined) return;
  const p = v.p;
  if (!p) {
    forget(v.id);
    $('app').replaceChildren(note('포트럭이 없어요', '지워졌거나 링크가 잘못됐어요.', button('새 포트럭 만들기', () => { location.hash = ''; }, 'btn')));
    v.built = false;
    return;
  }
  if (!v.built) build(v);
  paintBoard(v);
  v.$sign.hidden = p.closed;
  if (!p.closed) paintSign(v);
  v.$owner.hidden = !p.isOwner;
  if (p.isOwner) paintOwner(v);
}
// 틀: 신청 현황 · 내 신청 · 나눠 주기 · 만든 사람. 입력 칸은 여기서 한 번만 붙이고 옮기지 않음 (한글 조합이 안 끊기게)
function build(v) {
  remember(v.id, v.p.title);
  v.$board = h('section', 'panel pot-panel');
  v.$sign = h('section', 'panel pot-panel');
  v.$signHead = h('h2');
  v.$cats = h('div', 'pills pot-pick');
  v.$ex = h('div', 'pills pot-ex');
  v.$signBtns = h('div', 'play-btns');
  v.$sign.append(v.$signHead, v.name, v.$cats, v.$ex, v.dish, v.$signBtns,
    h('p', 'hint', '카테고리를 고르고 예시를 누르거나 가져올 메뉴를 직접 적어요. 줄 그은 메뉴는 이미 누가 가져와요. 메뉴는 나중에 정해도 돼요. 이 기기에서 한 사람만 신청돼요.'));
  v.$owner = h('section', 'panel pot-panel');
  v.$ownerTop = h('div', 'pot-owner');
  v.$restBox = h('div', 'pot-owner');
  v.$restInfo = h('p', 'hint');
  v.$restBox.append(h('b', '', '아직 안 정한 사람'), v.rest, v.$restInfo);
  v.$ownerBtns = h('div', 'play-btns');
  v.$slots = h('ul', 'pot-setup');
  const del = h('div', 'play-btns');
  del.append(button('포트럭 지우기', () => removePotluck(v), 'btn'));
  v.$owner.append(h('h2', '', '만든 사람만'), v.$restBox, v.$ownerBtns, h('b', '', '칸 수'), v.$slots, del,
    h('p', 'hint', '이 기기(브라우저)에서 만든 포트럭이라 마감하고 칸 수를 바꾸고, ✕로 신청을 뺄 수 있어요.'));
  $('app').replaceChildren(v.$board, v.$sign, sharePanel(v), v.$owner);
  v.built = true;
}
function paintBoard(v) {
  const p = v.p, chips = h('div', 'pot-chips'), total = p.cats.reduce((a, c) => a + c.slots, 0);
  for (const c of [`${v.entries.length}명 신청`, `칸 ${total}개`, p.closed && '🏁 마감']) if (c) chips.append(h('span', '', c));
  const board = h('div', 'pot-board');
  p.cats.forEach((c, i) => {
    const list = entriesIn(v.entries, i);
    if (!c.slots && !list.length) return;
    const box = h('section', `pot-cat${list.length >= c.slots ? ' full' : ''}${list.length > c.slots ? ' over' : ''}`), ul = h('ul');
    const head = h('div', 'pot-cat-head');
    head.append(h('b', '', c.name), h('span', '', `${list.length}/${c.slots}`));
    for (const e of list) {
      const li = h('li', e.mine ? 'mine' : ''), body = h('span', 'pot-entry');
      body.append(h('b', '', e.name), h('span', '', e.dish || '메뉴 미정'));
      li.append(body);
      if (e.host) li.append(h('small', '', '🎲 랜덤'));
      if (e.mine) li.append(h('small', '', '나'));
      if (p.isOwner) {
        const x = button('✕', () => { if (confirm(`${e.name}님 신청을 뺄까요?`)) potDb.removeEntry(v.id, e.id).catch(err => toast(errText(err), 3500)); }, 'icon-btn small');
        x.title = '신청 빼기';
        li.append(x);
      }
      ul.append(li);
    }
    for (let k = list.length; k < c.slots; k++) ul.append(h('li', 'empty', '빈 칸'));
    box.append(head, ul);
    board.append(box);
  });
  v.$board.replaceChildren(h('h2', 'pot-title', p.title), chips, board);
}
function paintSign(v) {
  const p = v.p, mine = v.entries.find(e => e.mine), sel = v.sel ?? mine?.cat ?? null;
  v.$cats.replaceChildren(...p.cats.map((c, i) => {
    const left = c.slots - entriesIn(v.entries, i).length, b = button(`${c.name} ${left > 0 ? `· ${left}칸` : '· 다 참'}`, () => { v.sel = i; paint(v); }, sel === i ? 'on' : '');
    b.disabled = !c.slots || (left <= 0 && mine?.cat !== i);
    return b;
  }));
  v.dish.placeholder = sel == null ? '가져올 메뉴 (비워 둬도 돼요)' : '가져올 메뉴 (직접 적어도 돼요)';
  // 고른 카테고리의 예시 메뉴: 누르면 메뉴 칸에. 다른 사람이 이미 가져오는 메뉴는 줄을 그음
  const taken = new Set(v.entries.filter(e => !e.mine && e.dish).map(e => nameKey(e.dish)));
  v.$ex.hidden = sel == null;
  v.$ex.replaceChildren(...(sel == null ? [] : exList(p.cats[sel].ex).map(x => {
    const b = button(x, () => { v.dish.value = x; v.dishTouched = true; paint(v); }, `${v.dish.value === x ? 'on' : ''}${taken.has(nameKey(x)) ? ' taken' : ''}`);
    if (taken.has(nameKey(x))) b.title = '이미 누가 가져와요';
    return b;
  })));
  if (mine && !v.dishTouched) v.dish.value = mine.dish; // 내 신청 메뉴를 칸에 (고치는 중이면 그대로)
  v.$signHead.textContent = mine ? `✓ 신청했어요 · ${p.cats[mine.cat].name}` : '🙋 내 신청';
  const go = button(mine ? '바꾸기' : '신청하기', () => sign(v, sel), 'btn primary');
  go.disabled = sel == null || v.busy;
  v.$signBtns.replaceChildren(go);
  if (mine) v.$signBtns.append(button('신청 취소', () => unsign(v), 'btn'));
}
function paintOwner(v) {
  const p = v.p;
  v.$slots.replaceChildren(...p.cats.map((c, i) => {
    const li = h('li');
    li.append(h('b', '', c.name), stepper(c.slots, 0, 15, n => potDb.setCats(v.id, p.cats.map((x, k) => (k === i ? { ...x, slots: n } : x))).catch(e => toast(errText(e), 3500))));
    return li;
  }));
  v.$restBox.hidden = p.closed;
  if (p.closed) { v.$ownerBtns.replaceChildren(button('다시 열기', () => setClosed(v, false), 'btn')); return; }
  const picks = fillRandom(p.cats, v.entries, parseNames(v.rest.value)), holes = openSlots(p.cats, v.entries).reduce((a, b) => a + b, 0);
  v.$restInfo.textContent = `${picks.length}명 · 남은 칸 ${holes}개${picks.length > holes ? ' — 칸보다 사람이 많아서, 넘치는 사람은 칸이 있는 카테고리 아무 데나 들어가요' : ''}`;
  const fill = button(`🎲 ${picks.length}명 랜덤으로 넣고 마감`, () => fillAndClose(v), 'btn primary');
  fill.disabled = !picks.length;
  v.$ownerBtns.replaceChildren(fill, button('마감만', () => setClosed(v, true), 'btn'));
}
async function sign(v, cat) {
  const name = v.name.value.trim(), dish = v.dish.value.trim();
  if (!name) { toast('이름을 적어 주세요'); v.name.focus(); return; }
  prefs.set({ name });
  const again = v.entries.some(e => e.mine);
  v.busy = true;
  paint(v);
  try {
    await potDb.sign(v.id, name, cat, dish);
    v.sel = null;
    v.dishTouched = false;
    toast(again ? '바꿨어요' : '신청했어요');
  } catch (e) { toast(errText(e), 3500); }
  v.busy = false;
  paint(v);
}
async function unsign(v) {
  if (!confirm('신청을 취소할까요?')) return;
  try {
    await potDb.unsign(v.id);
    v.sel = null;
    v.dish.value = '';
    toast('신청을 취소했어요');
  } catch (e) { toast(errText(e), 3500); }
}
function sharePanel(v) {
  const url = `${location.origin}${location.pathname}#${v.id}`, btns = h('div', 'play-btns');
  btns.append(button('🔗 링크 복사', () => copy(url, '링크를 복사했어요', '링크를 복사해 주세요'), 'btn'));
  if (navigator.share) btns.append(button('공유', () => navigator.share({ title: v.p.title, text: `${v.p.title} — 가져올 메뉴를 신청해 주세요!`, url }).catch(() => {}), 'btn'));
  btns.append(button('📋 목록 복사', () => copy(potluckText(v.p.title, v.p.cats, v.entries), '목록을 복사했어요. 단톡방에 붙여 넣어요', '목록을 복사해 주세요'), 'btn'));
  return note('📣 나눠 주기', '링크를 단톡방에 올리면 각자 폰에서 신청해요. 목록 복사는 지금 신청 현황을 글로 복사해요.', btns);
}
async function copy(text, done, ask) {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { prompt(ask, text); } // 복사가 안 되는 브라우저
}
async function fillAndClose(v) {
  const picks = fillRandom(v.p.cats, v.entries, parseNames(v.rest.value));
  if (!confirm(`${picks.length}명을 남은 칸에 랜덤으로 넣고 신청을 마감할까요?`)) return;
  try {
    await potDb.fillAndClose(v.id, picks);
    fanfare();
    toast(`${picks.length}명을 랜덤으로 넣고 마감했어요`);
  } catch (e) { toast(errText(e), 3500); }
}
function setClosed(v, closed) {
  potDb.setClosed(v.id, closed).then(() => toast(closed ? '마감했어요' : '다시 열었어요'), e => toast(errText(e), 3500));
}
async function removePotluck(v) {
  if (!confirm('이 포트럭을 지울까요? 신청이 모두 지워지고, 링크를 열어도 ‘포트럭이 없어요’로 나와요.')) return;
  try {
    view = null;
    v.stop();
    await potDb.remove(v.id);
    forget(v.id);
    location.hash = '';
    toast('지웠어요');
  } catch (e) { toast(errText(e), 3500); route(); }
}

addEventListener('hashchange', route);
route();
