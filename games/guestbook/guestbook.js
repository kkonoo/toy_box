'use strict';
// 방명록: 행사 이름·날짜·장소를 적어 만들고 링크(·QR)로 나눠 주면, 받은 사람이 폰에서 이름·남길 말·다음에 바라는 점을 적고 ✅ 왔어요 · 🙅 못 왔어요로 남김
// 남긴 글은 링크를 받은 사람 모두 봄. 방명록 고치기·지우기, 남의 글 빼기는 만든 기기만 (firestore.rules)
// 저장은 Firebase (guestbook-db.js). 주소 # 뒤가 방명록 id
const prefs = store('guestbook', { name: '', recent: [] }); // 내 이름, 이 기기에서 연 방명록 [{ id, title }]
const remember = (id, title) => prefs.set({ recent: [{ id, title }, ...prefs.get().recent.filter(p => p.id !== id)].slice(0, 10) });
const forget = id => prefs.set({ recent: prefs.get().recent.filter(p => p.id !== id) });
let view = null; // 지금 보는 방명록

function route() {
  view?.stop();
  view = null;
  const id = location.hash.slice(1);
  if (!firebaseConfig) $('app').replaceChildren(note('📖 아직 준비 중이에요', '방명록은 남긴 글을 Firebase에 모아요. Firebase 설정(js/firebase-config.js)을 넣으면 쓸 수 있어요.'));
  else if (id) openBook(id);
  else $('app').replaceChildren(formPanel(null, create), recentPanel());
}
function note(title, text, ...rest) {
  const panel = h('section', 'panel gb-panel');
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
const field = (label, el) => { const l = h('label', 'gb-field'); l.append(h('b', '', label), el); return l; };
function input(type, max, value, placeholder) {
  const i = h('input', 'text-input');
  i.type = type;
  if (max) i.maxLength = max;
  i.value = value;
  if (placeholder) i.placeholder = placeholder;
  return i;
}
function area(rows, max, placeholder) {
  const t = h('textarea');
  t.rows = rows;
  t.maxLength = max;
  t.placeholder = placeholder;
  return t;
}

// ---------- 1. 방명록 만들기 · 고치기 (같이 씀) ----------
// g = 고칠 방명록(새로면 null), onSave(data, go) = 저장
function formPanel(g, onSave, onCancel) {
  const panel = h('form', 'panel gb-panel'), f = {};
  f.title = input('text', MAX_TITLE, g?.title ?? '', '예: 연구실 송년회, 집들이');
  f.date = input('date', 0, g?.date ?? today());
  f.place = input('text', MAX_PLACE, g?.place ?? '', '안 적어도 돼요');
  const go = h('button', 'btn primary big', g ? '고친 대로 저장' : '📖 방명록 만들기');
  panel.append(h('h2', '', g ? '✎ 방명록 고치기' : '새 방명록'), field('행사 이름', f.title), field('날짜', f.date), field('장소', f.place), go);
  if (onCancel) panel.append(button('그만 고치기', onCancel, 'btn'));
  panel.addEventListener('submit', e => {
    e.preventDefault();
    const data = { title: f.title.value.trim(), date: f.date.value, place: f.place.value.trim() };
    if (!data.title) { toast('행사 이름을 적어 주세요'); f.title.focus(); return; }
    if (!data.date) { toast('날짜를 골라 주세요'); f.date.focus(); return; }
    onSave(data, go);
  });
  return panel;
}
async function create(data, go) {
  go.disabled = true;
  go.textContent = '만드는 중…';
  try {
    const id = await bookDb.create(data);
    remember(id, data.title);
    location.hash = id;
    toast('만들었어요. 링크나 QR을 나눠 주세요');
  } catch (e) {
    toast(errText(e), 3500);
    go.disabled = false;
    go.textContent = '📖 방명록 만들기';
  }
}
function recentPanel() {
  const list = prefs.get().recent;
  if (!list.length) return '';
  const ul = h('ul', 'gb-recent');
  for (const p of list) {
    const li = h('li'), a = h('a', '', p.title), x = button('✕', () => { forget(p.id); route(); }, 'icon-btn small');
    a.href = `#${p.id}`;
    x.title = '목록에서 빼기';
    x.setAttribute('aria-label', '목록에서 빼기');
    li.append(a, x);
    ul.append(li);
  }
  return note('이 기기에서 연 방명록', '목록에서 빼도 방명록은 그대로예요.', ul);
}

// ---------- 2. 방명록 보기 · 남기기 ----------
// 이름·남길 말·바라는 점 칸은 한 번만 만들어 두고 바뀐 부분만 다시 그림 → 다른 사람 글이 들어와도 쓰던 글자가 안 지워짐
async function openBook(id) {
  const v = { id, book: undefined, entries: undefined, busy: false, editing: false, touched: false, w: null, stop() { this.w?.stop(); } };
  v.name = input('text', MAX_NAME, prefs.get().name, '내 이름');
  v.msg = area(3, MAX_MSG, '오늘 어땠는지, 하고 싶은 말 (안 써도 돼요)');
  v.wish = area(2, MAX_WISH, '다음 모임엔 이런 게 있으면 좋겠어요 (안 써도 돼요)');
  for (const t of [v.msg, v.wish]) t.addEventListener('input', () => { v.touched = true; });
  view = v;
  $('app').replaceChildren(h('p', 'gb-wait', '불러오는 중…'));
  const fail = e => { if (view !== v) return; v.stop(); view = null; $('app').replaceChildren(note('연결하지 못했어요', errText(e), button('다시 시도', route, 'btn'))); };
  try {
    v.w = await bookDb.watch(id, { book: x => { v.book = x; paint(v); }, entries: list => { v.entries = list; paint(v); }, error: fail });
  } catch (e) { return fail(e); }
  if (view !== v) v.w.stop();
}
function paint(v) {
  if (view !== v || v.book === undefined || v.entries === undefined) return;
  if (!v.book) {
    forget(v.id);
    $('app').replaceChildren(note('방명록이 없어요', '지워졌거나 링크가 잘못됐어요.', button('새 방명록 만들기', () => { location.hash = ''; }, 'btn')));
    v.built = false;
    return;
  }
  if (!v.built) build(v);
  remember(v.id, v.book.title);
  if (!v.editing) v.$card.replaceChildren(cardPanel(v.book));
  paintSign(v);
  paintEntries(v);
  v.$owner.hidden = !v.book.isOwner;
}
// 틀: 행사 · 남기기 · 남긴 글 · 나눠 주기 · 만든 사람
function build(v) {
  v.$card = h('div', 'gb-slot'); // 행사 카드, 고칠 때는 쓰기 칸
  v.$sign = h('section', 'panel gb-panel');
  v.$signHead = h('h2');
  v.$answers = h('div', 'gb-answers');
  v.$mine = h('p', 'hint');
  v.$sign.append(v.$signHead, field('이름', v.name), field('남길 말', v.msg), field('💡 다음에 바라는 점', v.wish), v.$answers, v.$mine);
  v.$list = h('section', 'panel gb-panel');
  v.$owner = h('section', 'panel gb-panel');
  const ob = h('div', 'play-btns');
  ob.append(button('✎ 방명록 고치기', () => startEdit(v), 'btn'), button('방명록 지우기', () => removeBook(v), 'btn'));
  v.$owner.append(h('h2', '', '만든 사람만'), ob, h('p', 'hint', '이 기기(브라우저)에서 만든 방명록이라 고치고 지울 수 있어요. 엉뚱한 글은 ✕로 빼요.'));
  $('app').replaceChildren(v.$card, v.$sign, v.$list, sharePanel(v), v.$owner);
  v.built = true;
}
function cardPanel(g) {
  const card = h('section', 'panel gb-card'), rows = h('div', 'gb-rows');
  const row = (icon, text) => { const r = h('div', 'gb-row'); r.append(h('span', 'gb-icon', icon), h('b', '', text)); return r; };
  rows.append(row('📅', dateLabel(g.date)));
  if (g.place) rows.append(row('📍', g.place));
  card.append(h('div', 'gb-top', '📖 방명록을 남겨 주세요'), h('h2', 'gb-title', g.title), rows);
  return card;
}
function paintSign(v) {
  const mine = v.entries.find(e => e.mine);
  v.$signHead.textContent = mine ? `✓ 남겼어요 · ${ATTEND.find(a => a[0] === mine.came).slice(1).join(' ')}` : '📝 방명록 남기기';
  if (mine && !v.touched) { v.msg.value = mine.msg; v.wish.value = mine.wish; }
  v.$answers.replaceChildren(...ATTEND.map(([came, icon, label]) => {
    const b = button(`${icon} ${label}`, () => sign(v, came), `btn${mine?.came === came ? ' primary' : ''}`);
    b.disabled = v.busy;
    return b;
  }));
  v.$mine.replaceChildren(mine ? '글을 고쳤으면 다시 눌러야 저장돼요. ' : '이름을 적고 왔는지 눌러 남겨요. 남긴 글은 링크를 받은 사람 모두에게 보여요.');
  if (mine) v.$mine.append(button('글 빼기', () => unsign(v), 'btn small'));
}
function paintEntries(v) {
  const n = attendCount(v.entries), count = h('div', 'gb-count'), groups = h('div', 'gb-groups');
  count.append(h('span', 'came', `✅ 왔어요 ${n.came}`), h('span', '', `🙅 못 왔어요 ${n.missed}`));
  for (const [came, icon, label] of ATTEND) {
    const list = v.entries.filter(e => e.came === came);
    if (!list.length) continue;
    const box = h('div', `gb-group${came ? ' came' : ''}`), ul = h('ul');
    for (const e of list) {
      const li = h('li', e.mine ? 'mine' : ''), top = h('div', 'gb-who');
      top.append(h('b', '', e.name));
      if (v.book.isOwner && !e.mine) {
        const x = button('✕', () => { if (confirm(`${e.name}님 글을 뺄까요?`)) bookDb.removeEntry(v.id, e.id).catch(err => toast(errText(err), 3500)); }, 'icon-btn small');
        x.title = '글 빼기';
        x.setAttribute('aria-label', `${e.name}님 글 빼기`);
        top.append(x);
      }
      li.append(top);
      if (e.msg) li.append(h('p', 'gb-msg', e.msg));
      if (e.wish) { const p = h('p', 'gb-wish'); p.append(h('b', '', '💡 바라는 점 '), e.wish); li.append(p); }
      ul.append(li);
    }
    box.append(h('h3', '', `${icon} ${label} ${list.length}명`), ul);
    groups.append(box);
  }
  const head = h('div', 'panel-head');
  head.append(h('h2', '', '📖 남긴 글'), button('📊 엑셀로 받기', () => saveXlsx(v), 'btn small'));
  v.$list.replaceChildren(head, count, v.entries.length ? groups : h('p', 'hint', '아직 남긴 글이 없어요.'));
}
// 행사 정보와 남긴 글을 엑셀 파일(.xlsx)로 내려받음 (보이는 글 그대로, 링크를 연 기기 어디서나)
function saveXlsx(v) {
  const blob = new Blob([xlsxBytes('방명록', exportRows(v.book, v.entries), EXPORT_WIDTHS)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = h('a');
  a.href = URL.createObjectURL(blob);
  a.download = exportName(v.book);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast('엑셀 파일을 내려받았어요');
}
async function sign(v, came) {
  const name = v.name.value.trim();
  if (!name) { toast('이름을 적어 주세요'); v.name.focus(); return; }
  prefs.set({ name });
  v.busy = true;
  paint(v);
  try {
    await bookDb.sign(v.id, { name, came, msg: v.msg.value.trim(), wish: v.wish.value.trim() });
    v.touched = false;
    toast('방명록에 남겼어요');
    if (came) fanfare();
  } catch (e) { toast(errText(e), 3500); }
  v.busy = false;
  paint(v);
}
async function unsign(v) {
  if (!confirm('남긴 글을 뺄까요?')) return;
  try {
    await bookDb.unsign(v.id);
    v.msg.value = '';
    v.wish.value = '';
    v.touched = false;
    toast('글을 뺐어요');
  } catch (e) { toast(errText(e), 3500); }
}
function sharePanel(v) {
  const url = `${location.origin}${location.pathname}#${v.id}`, btns = h('div', 'play-btns'), qrBox = h('div', 'gb-qr');
  btns.append(button('🔗 링크 복사', async () => {
    try { await navigator.clipboard.writeText(`${shareText(v.book)}\n${url}`); toast('안내 글과 링크를 복사했어요'); } catch { prompt('링크를 복사해 주세요', url); } // 복사가 안 되는 브라우저
  }, 'btn'));
  if (navigator.share) btns.append(button('공유', () => navigator.share({ title: v.book.title, text: shareText(v.book), url }).catch(() => {}), 'btn'));
  qrBox.hidden = true;
  btns.append(button('QR', () => { if (!qrBox.firstChild) qrBox.append(qrSvg(url)); qrBox.hidden = !qrBox.hidden; }, 'btn'));
  return note('📣 나눠 주기', '행사 자리에 QR을 띄워 두거나, 링크를 단톡방에 올려요. 링크 복사는 행사 이름·날짜를 적은 안내 글과 같이 복사해요.', btns, qrBox);
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
  v.$card.replaceChildren(formPanel(v.book, async (data, go) => {
    go.disabled = true;
    try {
      await bookDb.update(v.id, data);
      v.editing = false;
      toast('고쳤어요');
      paint(v);
    } catch (e) { toast(errText(e), 3500); go.disabled = false; }
  }, () => { v.editing = false; paint(v); }));
  v.$card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function removeBook(v) {
  if (!confirm('이 방명록을 지울까요? 남긴 글도 모두 지워지고, 링크를 열어도 ‘방명록이 없어요’로 나와요.')) return;
  try {
    view = null;
    v.stop();
    await bookDb.remove(v.id);
    forget(v.id);
    location.hash = '';
    toast('지웠어요');
  } catch (e) { toast(errText(e), 3500); route(); }
}

addEventListener('hashchange', route);
route();
