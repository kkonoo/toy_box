'use strict';
// 초대장: 파티 이름·일시·장소·식순·안내를 적어 만들고 링크(·QR)로 나눠 주면, 받은 사람이 폰에서 🙋 갈게요 · 🤔 아직 몰라요 · 🙅 못 가요로 답함
// 누가 오는지는 링크를 받은 사람 모두 봄. 초대장 고치기·지우기는 만든 기기만 (firestore.rules)
// 저장은 Firebase (invite-db.js). 주소 # 뒤가 초대장 id
const prefs = store('invite', { name: '', recent: [] }); // 내 이름, 이 기기에서 연 초대장 [{ id, title }]
const remember = (id, title) => prefs.set({ recent: [{ id, title }, ...prefs.get().recent.filter(p => p.id !== id)].slice(0, 10) });
const forget = id => prefs.set({ recent: prefs.get().recent.filter(p => p.id !== id) });
let view = null; // 지금 보는 초대장

function route() {
  view?.stop();
  view = null;
  const id = location.hash.slice(1);
  if (!firebaseConfig) $('app').replaceChildren(note('💌 아직 준비 중이에요', '초대장은 답장을 Firebase에 모아요. Firebase 설정(js/firebase-config.js)을 넣으면 쓸 수 있어요.'));
  else if (id) openInvite(id);
  else $('app').replaceChildren(formPanel(null, create), recentPanel());
}
function note(title, text, ...rest) {
  const panel = h('section', 'panel inv-panel');
  panel.append(h('h2', '', title), h('p', 'hint', text), ...rest);
  return panel;
}
function errText(e) {
  const c = e?.code || '';
  if (c === 'auth/operation-not-allowed' || c === 'auth/admin-restricted-operation') return 'Firebase 콘솔에서 익명 로그인을 켜 주세요';
  if (!navigator.onLine || c === 'unavailable' || c === 'auth/network-request-failed' || e instanceof TypeError) return '인터넷 연결을 확인해 주세요';
  if (c === 'permission-denied') return '할 수 없는 일이에요 (Firebase 규칙이 아직 안 올라갔을 수 있어요)';
  return `잘 안 됐어요 (${c || e?.message || e})`;
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- 1. 초대장 쓰기 (새로 만들기 · 고치기 같이 씀) ----------
// inv = 고칠 초대장(새로면 null), onSave(data, go) = 저장. 칸은 이 패널 안에만 있어서 다시 그려도 쓰던 글자가 그대로
function formPanel(inv, onSave, onCancel) {
  const panel = h('form', 'panel inv-panel'), f = {};
  const field = (label, el, ...rest) => { const l = h('label', 'inv-field'); l.append(h('b', '', label), el, ...rest); return l; };
  const input = (type, max, value, placeholder) => { const i = h('input', 'text-input'); i.type = type; if (max) i.maxLength = max; i.value = value; if (placeholder) i.placeholder = placeholder; return i; };
  const area = (rows, max, value, placeholder) => { const t = h('textarea'); t.rows = rows; t.maxLength = max; t.value = value; t.placeholder = placeholder; return t; };
  f.title = input('text', MAX_TITLE, inv?.title ?? '🎄 크리스마스 파티');
  f.date = input('date', 0, inv?.date ?? '');
  f.time = input('time', 0, inv?.time ?? '18:00');
  f.until = input('time', 0, inv?.until ?? '');
  f.place = input('text', MAX_PLACE, inv?.place ?? '', '예: 연구실 3층 세미나실, ○○동 ○○빌라');
  f.program = area(6, MAX_PROGRAM, inv?.program ?? '', '한 줄에 하나씩, 앞에 시간을 적으면 시간표로 보여요\n18:00 모여서 인사\n18:30 포트럭 식사');
  f.note = area(4, MAX_NOTE, inv?.note ?? '', '회비, 드레스 코드, 선물 가격, 준비물 같은 것\n포트럭 신청 링크를 붙이면 누를 수 있게 보여요');
  const when = h('div', 'inv-when');
  when.append(f.date, f.time, h('span', '', '~'), f.until);
  const example = button('식순 예시 넣기', () => { f.program.value = PROGRAM_EXAMPLE; }, 'btn small');
  const go = h('button', 'btn primary big', inv ? '고친 대로 저장' : '💌 초대장 만들기');
  panel.append(h('h2', '', inv ? '✎ 초대장 고치기' : '새 초대장'), field('파티 이름', f.title),
    field('일시', when, h('span', 'hint', '끝나는 시간은 안 적어도 돼요')), field('장소', f.place),
    field('식순', f.program, example), field('안내', f.note), go);
  if (onCancel) panel.append(button('그만 고치기', onCancel, 'btn'));
  panel.addEventListener('submit', e => {
    e.preventDefault();
    const data = { title: f.title.value.trim(), date: f.date.value, time: f.time.value, until: f.until.value, place: f.place.value.trim(), program: f.program.value.trim(), note: f.note.value.trim() };
    if (!data.title) { toast('파티 이름을 적어 주세요'); f.title.focus(); return; }
    if (!data.date) { toast('날짜를 골라 주세요'); f.date.focus(); return; }
    if (!data.time) { toast('시작 시간을 골라 주세요'); f.time.focus(); return; }
    onSave(data, go);
  });
  return panel;
}
async function create(data, go) {
  go.disabled = true;
  go.textContent = '만드는 중…';
  try {
    const id = await inviteDb.create(data);
    remember(id, data.title);
    location.hash = id;
    toast('만들었어요. 링크를 나눠 주세요');
  } catch (e) {
    toast(errText(e), 3500);
    go.disabled = false;
    go.textContent = '💌 초대장 만들기';
  }
}
function recentPanel() {
  const list = prefs.get().recent;
  if (!list.length) return '';
  const ul = h('ul', 'inv-recent');
  for (const p of list) {
    const li = h('li'), a = h('a', '', p.title), x = button('✕', () => { forget(p.id); route(); }, 'icon-btn small');
    a.href = `#${p.id}`;
    x.title = '목록에서 빼기';
    li.append(a, x);
    ul.append(li);
  }
  return note('이 기기에서 연 초대장', '목록에서 빼도 초대장은 그대로예요.', ul);
}

// ---------- 2. 초대장 보기 · 답장 ----------
// 이름·한마디 칸은 한 번만 만들어 두고(build) 바뀐 부분만 다시 그림 → 다른 사람 답장이 들어와도 쓰던 글자가 안 지워짐
async function openInvite(id) {
  const v = { id, inv: undefined, rsvps: undefined, busy: false, editing: false, w: null, stop() { this.w?.stop(); } };
  v.name = h('input', 'text-input');
  v.name.maxLength = MAX_NAME;
  v.name.placeholder = '내 이름';
  v.name.value = prefs.get().name;
  v.msg = h('input', 'text-input');
  v.msg.maxLength = MAX_MSG;
  v.msg.placeholder = '한마디 (안 써도 돼요)';
  v.msg.addEventListener('input', () => { v.msgTouched = true; });
  view = v;
  $('app').replaceChildren(h('p', 'inv-wait', '불러오는 중…'));
  const fail = e => { if (view !== v) return; v.stop(); view = null; $('app').replaceChildren(note('연결하지 못했어요', errText(e), button('다시 시도', route, 'btn'))); };
  try {
    v.w = await inviteDb.watch(id, { invite: x => { v.inv = x; paint(v); }, rsvps: list => { v.rsvps = list; paint(v); }, error: fail });
  } catch (e) { return fail(e); }
  if (view !== v) v.w.stop();
}
function paint(v) {
  if (view !== v || v.inv === undefined || v.rsvps === undefined) return;
  if (!v.inv) {
    forget(v.id);
    $('app').replaceChildren(note('초대장이 없어요', '지워졌거나 링크가 잘못됐어요.', button('새 초대장 만들기', () => { location.hash = ''; }, 'btn')));
    v.built = false;
    return;
  }
  if (!v.built) build(v);
  remember(v.id, v.inv.title);
  if (!v.editing) v.$card.replaceChildren(cardPanel(v.inv));
  paintReply(v);
  v.$owner.hidden = !v.inv.isOwner;
}
// 틀: 초대장 · 답장 · 나눠 주기 · 만든 사람
function build(v) {
  v.$card = h('div', 'inv-slot'); // 초대장, 고칠 때는 쓰기 칸
  v.$reply = h('section', 'panel inv-panel');
  v.$replyHead = h('h2');
  v.$answers = h('div', 'inv-answers');
  v.$mine = h('p', 'hint');
  v.$count = h('div', 'inv-count');
  v.$guests = h('div', 'inv-guests');
  v.$reply.append(v.$replyHead, v.name, v.msg, v.$answers, v.$mine, v.$count, v.$guests);
  v.$owner = h('section', 'panel inv-panel');
  const ob = h('div', 'play-btns');
  ob.append(button('✎ 초대장 고치기', () => startEdit(v), 'btn'), button('초대장 지우기', () => removeInvite(v), 'btn'));
  v.$owner.append(h('h2', '', '만든 사람만'), ob, h('p', 'hint', '이 기기(브라우저)에서 만든 초대장이라 고치고 지울 수 있어요. 엉뚱한 답장은 ✕로 빼요.'));
  $('app').replaceChildren(v.$card, v.$reply, sharePanel(v), v.$owner);
  v.built = true;
}
function cardPanel(inv) {
  const card = h('section', 'panel inv-card'), d = dday(inv.date, today()), top = h('div', 'inv-top');
  top.append(h('span', '', '💌 초대합니다'));
  if (d) top.append(h('span', 'inv-dday', d));
  const rows = h('div', 'inv-rows');
  const row = (icon, ...body) => { const r = h('div', 'inv-row'); const b = h('div'); b.append(...body); r.append(h('span', 'inv-icon', icon), b); return r; };
  rows.append(row('📅', h('b', '', dateLabel(inv.date)), h('span', '', `${timeLabel(inv.time)}${inv.until ? ` ~ ${timeLabel(inv.until)}` : ''}`)));
  if (inv.place) {
    const map = h('a', 'inv-map', '🗺️ 지도에서 보기');
    map.href = mapUrl(inv.place);
    map.target = '_blank';
    map.rel = 'noopener noreferrer';
    rows.append(row('📍', h('b', '', inv.place), map));
  }
  const parts = [top, h('h2', 'inv-title', inv.title), rows];
  const prog = parseProgram(inv.program);
  if (prog.length) {
    const ol = h('ol', 'inv-program');
    for (const p of prog) { const li = h('li'); li.append(h('time', '', p.time), h('span', '', p.text)); ol.append(li); }
    parts.push(h('h3', 'inv-sub', '🕯️ 식순'), ol);
  }
  if (inv.note) parts.push(h('h3', 'inv-sub', '📌 안내'), linkText(inv.note));
  card.append(...parts);
  return card;
}
// 글 속 http(s) 주소만 누를 수 있게 (나머지는 그냥 글)
function linkText(text) {
  const p = h('p', 'inv-note');
  for (const part of linkParts(text)) {
    if (part.text != null) { p.append(part.text); continue; }
    const a = h('a', '', part.url);
    a.href = part.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    p.append(a);
  }
  return p;
}
function paintReply(v) {
  const mine = v.rsvps.find(r => r.mine), n = rsvpCount(v.rsvps);
  v.$replyHead.textContent = mine ? `✓ 답했어요 · ${RSVP.find(x => x[0] === mine.answer).slice(1).join(' ')}` : '🙋 오실 수 있나요?';
  if (mine && !v.msgTouched) v.msg.value = mine.msg;
  v.$answers.replaceChildren(...RSVP.map(([k, icon, label]) => {
    const b = button(`${icon} ${label}`, () => reply(v, k), `btn${mine?.answer === k ? ' primary' : ''}`);
    b.disabled = v.busy;
    return b;
  }));
  v.$mine.replaceChildren(mine ? '바꾸려면 다른 답을 누르면 돼요. ' : '이름을 적고 답을 눌러요. 한마디는 모두에게 보여요.');
  if (mine) v.$mine.append(button('답장 빼기', () => unreply(v), 'btn small'));
  v.$count.replaceChildren(...RSVP.map(([k, icon, label]) => h('span', k, `${icon} ${label} ${n[k]}`)));
  v.$guests.replaceChildren(...RSVP.filter(([k]) => n[k]).map(([k, icon, label]) => {
    const box = h('div', `inv-group ${k}`), ul = h('ul');
    for (const r of v.rsvps.filter(x => x.answer === k)) {
      const li = h('li', r.mine ? 'mine' : '');
      li.append(h('b', '', r.name));
      if (r.msg) li.append(h('span', '', r.msg));
      if (v.inv.isOwner && !r.mine) {
        const x = button('✕', () => { if (confirm(`${r.name}님 답장을 뺄까요?`)) inviteDb.removeRsvp(v.id, r.id).catch(e => toast(errText(e), 3500)); }, 'icon-btn small');
        x.title = '답장 빼기';
        li.append(x);
      }
      ul.append(li);
    }
    box.append(h('h3', '', `${icon} ${label} ${n[k]}명`), ul);
    return box;
  }));
}
async function reply(v, answer) {
  const name = v.name.value.trim();
  if (!name) { toast('이름을 적어 주세요'); v.name.focus(); return; }
  prefs.set({ name });
  v.busy = true;
  paint(v);
  try {
    await inviteDb.reply(v.id, name, answer, v.msg.value.trim());
    v.msgTouched = false;
    toast(answer === 'yes' ? '🙋 갈게요로 답했어요' : answer === 'maybe' ? '🤔 아직 몰라요로 답했어요' : '🙅 못 가요로 답했어요');
    if (answer === 'yes') fanfare();
  } catch (e) { toast(errText(e), 3500); }
  v.busy = false;
  paint(v);
}
async function unreply(v) {
  if (!confirm('답장을 뺄까요?')) return;
  try {
    await inviteDb.unreply(v.id);
    v.msg.value = '';
    toast('답장을 뺐어요');
  } catch (e) { toast(errText(e), 3500); }
}
function sharePanel(v) {
  const url = `${location.origin}${location.pathname}#${v.id}`, btns = h('div', 'play-btns'), qrBox = h('div', 'inv-qr');
  const text = () => { const i = v.inv; return `${i.title}\n📅 ${whenLabel(i.date, i.time, i.until)}${i.place ? `\n📍 ${i.place}` : ''}\n오실 수 있는지 알려 주세요!`; };
  btns.append(button('🔗 링크 복사', async () => {
    try { await navigator.clipboard.writeText(`${text()}\n${url}`); toast('초대 글과 링크를 복사했어요'); } catch { prompt('링크를 복사해 주세요', url); } // 복사가 안 되는 브라우저
  }, 'btn'));
  if (navigator.share) btns.append(button('공유', () => navigator.share({ title: v.inv.title, text: text(), url }).catch(() => {}), 'btn'));
  qrBox.hidden = true;
  btns.append(button('QR', () => { if (!qrBox.firstChild) qrBox.append(qrSvg(url)); qrBox.hidden = !qrBox.hidden; }, 'btn'));
  return note('📣 나눠 주기', '링크 복사는 일시·장소를 적은 초대 글과 링크를 같이 복사해요. 단톡방에 그대로 붙여 넣어요.', btns, qrBox);
}
function qrSvg(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount(), m = 4, s = svg('svg', { class: 'qr', viewBox: `0 0 ${n + m * 2} ${n + m * 2}`, 'shape-rendering': 'crispEdges' });
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
  s.append(svg('rect', { width: n + m * 2, height: n + m * 2, fill: '#fff' }), svg('path', { d, fill: '#000' }));
  return s;
}
function startEdit(v) {
  v.editing = true;
  v.$card.replaceChildren(formPanel(v.inv, async (data, go) => {
    go.disabled = true;
    try {
      await inviteDb.update(v.id, data);
      v.editing = false;
      toast('고쳤어요');
      paint(v);
    } catch (e) { toast(errText(e), 3500); go.disabled = false; }
  }, () => { v.editing = false; paint(v); }));
  v.$card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function removeInvite(v) {
  if (!confirm('이 초대장을 지울까요? 답장도 모두 지워지고, 링크를 열어도 ‘초대장이 없어요’로 나와요.')) return;
  try {
    view = null;
    v.stop();
    await inviteDb.remove(v.id);
    forget(v.id);
    location.hash = '';
    toast('지웠어요');
  } catch (e) { toast(errText(e), 3500); route(); }
}

addEventListener('hashchange', route);
route();
