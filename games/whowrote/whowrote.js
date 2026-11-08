'use strict';
// 누가 썼을까: 진행하는 사람이 연말 질문을 골라 방을 만들고 QR을 띄우면, 각자 폰으로 몰래 답함
// '공개 시작'을 누르면 답을 마감하고, 큰 화면에 답을 하나씩 띄워 누가 썼는지 맞혀 본 뒤 이름을 공개
// 모든 답은 방을 만든 기기만 읽음 (whowrote-db.js, firestore.rules). 주소 # 뒤가 방 id
const prefs = store('whowrote', { name: '', picked: [0, 1, 2], reveal: {} }); // reveal = { 방 id: { order: [답 id], at, shown } } (만든 기기)
let view = null;

function route() {
  view?.stop();
  view = null;
  const id = location.hash.slice(1);
  if (!firebaseConfig) $('app').replaceChildren(note('🏆 아직 준비 중이에요', '누가 썼을까는 답을 Firebase에 모아요. Firebase 설정(js/firebase-config.js)을 넣으면 쓸 수 있어요.'));
  else if (id) openRoom(id);
  else $('app').replaceChildren(createPanel());
}
function note(title, text, ...rest) {
  const panel = h('section', 'panel who-panel');
  panel.append(h('h2', '', title), h('p', 'hint', text), ...rest);
  return panel;
}
function errText(e) {
  const c = e?.code || '';
  if (c === 'auth/operation-not-allowed' || c === 'auth/admin-restricted-operation') return 'Firebase 콘솔에서 익명 로그인을 켜 주세요';
  if (!navigator.onLine || c === 'unavailable' || c === 'auth/network-request-failed' || e instanceof TypeError) return '인터넷 연결을 확인해 주세요';
  if (c === 'permission-denied') return '할 수 없는 일이에요 (공개가 시작됐거나, Firebase 규칙이 아직 안 올라갔어요)';
  return `잘 안 됐어요 (${c || e?.message || e})`;
}

// ---------- 1. 방 만들기 (질문 고르기) ----------
const custom = []; // 직접 넣은 질문 (이 탭에서만)
function createPanel() {
  const panel = h('section', 'panel who-panel'), list = h('div', 'who-qs'), picked = prefs.get().picked, n = picked.length + custom.length;
  const redraw = () => $('app').replaceChildren(createPanel());
  const check = (label, on, onChange) => {
    const l = h('label', 'check'), box = h('input');
    box.type = 'checkbox';
    box.checked = on;
    box.disabled = !on && n >= MAX_QUESTIONS;
    box.addEventListener('change', () => onChange(box.checked));
    l.append(box, h('span', '', label));
    return l;
  };
  PRESET_QUESTIONS.forEach((q, i) => list.append(check(q, picked.includes(i), on => {
    prefs.set({ picked: on ? [...picked, i].sort((a, b) => a - b) : picked.filter(x => x !== i) });
    redraw();
  })));
  custom.forEach((q, i) => list.append(check(q, true, () => { custom.splice(i, 1); redraw(); })));
  const form = h('form', 'who-add'), input = h('input', 'text-input');
  input.maxLength = 40;
  input.placeholder = '질문 직접 넣기';
  input.disabled = n >= MAX_QUESTIONS;
  form.append(input, h('button', 'btn', '추가'));
  form.addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (q && n < MAX_QUESTIONS) { custom.push(q); redraw(); } });
  const go = button('🏆 방 만들기', () => create(go), 'btn primary big');
  go.disabled = !n;
  panel.append(h('h2', '', `질문 고르기 (${n}/${MAX_QUESTIONS})`), list, form, go,
    h('p', 'hint', '방을 만들면 큰 화면에 QR이 떠요. 각자 폰으로 찍어 몰래 답하고, 다 모이면 답을 하나씩 띄워 누가 썼는지 맞혀요. 답은 이 기기에서만 볼 수 있어요.'));
  return panel;
}
async function create(go) {
  go.disabled = true;
  go.textContent = '만드는 중…';
  try {
    const id = await whoDb.create([...prefs.get().picked.map(i => PRESET_QUESTIONS[i]), ...custom]);
    custom.length = 0;
    location.hash = id;
  } catch (e) {
    toast(errText(e), 3500);
    go.disabled = false;
    go.textContent = '🏆 방 만들기';
  }
}

// ---------- 2. 방 ----------
async function openRoom(id) {
  const v = { id, room: undefined, answers: null, mine: null, stops: [], busy: false, stop() { this.stops.forEach(f => f()); } };
  view = v;
  $('app').replaceChildren(h('p', 'who-wait', '불러오는 중…'));
  const fail = e => { if (view !== v) return; v.stop(); view = null; $('app').replaceChildren(note('연결하지 못했어요', errText(e), button('다시 시도', route, 'btn'))); };
  try {
    v.stops.push(await whoDb.watchRoom(id, async room => {
      v.room = room;
      if (room?.isOwner && !v.answersOn) { // 만든 기기: 모든 답을 지켜봄
        v.answersOn = true;
        v.stops.push(await whoDb.watchAnswers(id, list => { v.answers = list; paint(v); }, fail));
      }
      if (room && !room.isOwner && !v.mine) { // 답하는 사람: 내가 낸 답을 칸에 채움
        v.mine = await whoDb.mine(id, room.questions.length).catch(() => ({}));
      }
      paint(v);
    }, fail));
  } catch (e) { fail(e); }
}
function paint(v) {
  if (view !== v || v.room === undefined) return;
  const r = v.room;
  if (!r) { $('app').replaceChildren(note('방이 없어요', '지워졌거나 링크가 잘못됐어요.', button('새 방 만들기', () => { location.hash = ''; }, 'btn'))); return; }
  if (r.isOwner) { if (v.answers) $('app').replaceChildren(r.closed ? revealPanel(v) : waitPanel(v)); }
  else if (v.mine) $('app').replaceChildren(r.closed ? note('🎬 공개가 시작됐어요!', '큰 화면을 봐 주세요. 내 답이 나와도 모른 척!') : answerPanel(v));
}

// 답하는 사람 (폰): 이름과 질문마다 답. 칸은 한 번만 만들어 둠 (다시 그려도 쓰던 글자 그대로)
function answerPanel(v) {
  if (!v.form) {
    const form = h('form', 'panel who-panel'), name = h('input', 'text-input'), boxes = v.room.questions.map((q, i) => {
      const ta = h('textarea');
      ta.rows = 2;
      ta.maxLength = MAX_ANSWER;
      ta.value = v.mine[i]?.text || '';
      return ta;
    });
    name.maxLength = MAX_NAME;
    name.placeholder = '내 이름 (공개할 때 큰 화면에 나와요)';
    name.value = Object.values(v.mine)[0]?.name || prefs.get().name;
    const go = h('button', 'btn primary big'), status = h('p', 'hint');
    const paintBtn = () => {
      const sent = Object.keys(v.mine).length;
      go.textContent = sent ? '고치기' : '보내기';
      status.textContent = sent ? `✓ ${sent}개 보냈어요. 공개가 시작되기 전까지 고칠 수 있어요.` : '답은 진행하는 사람 기기에만 모이고, 공개할 때까지 아무도 몰라요.';
    };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const n = name.value.trim(), texts = boxes.map(b => b.value.trim());
      if (!n) { toast('이름을 적어 주세요'); name.focus(); return; }
      if (!texts.some(Boolean)) { toast('하나 이상 답해 주세요'); return; }
      prefs.set({ name: n });
      go.disabled = true;
      try {
        await whoDb.answer(v.id, n, texts);
        v.mine = Object.fromEntries(texts.map((text, q) => [q, { name: n, text }]).filter(([, a]) => a.text));
        toast('보냈어요');
      } catch (err) { toast(errText(err), 3500); }
      go.disabled = false;
      paintBtn();
    });
    form.append(h('h2', '', '🏆 누가 썼을까'), name);
    v.room.questions.forEach((q, i) => { const l = h('label', 'who-q'); l.append(h('b', '', `${i + 1}. ${q}`), boxes[i]); form.append(l); });
    form.append(go, status);
    paintBtn();
    v.form = form;
  }
  return v.form;
}

// 만든 기기 (큰 화면): 질문 · QR · 답한 사람 → 공개 시작
function waitPanel(v) {
  const panel = h('section', 'panel who-panel who-wait-panel'), url = `${location.origin}${location.pathname}#${v.id}`, qs = h('ol', 'who-list');
  for (const q of v.room.questions) qs.append(h('li', '', q));
  const names = [...new Set(v.answers.map(a => a.name))], who = h('div', 'who-names');
  for (const n of names) who.append(h('span', '', n));
  const side = h('div', 'who-side');
  side.append(h('h2', '', '📱 폰 카메라로 찍어서 답해요'), qrSvg(url), button('🔗 링크 복사', async () => {
    try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요'); } catch { prompt('링크를 복사해 주세요', url); }
  }, 'btn'));
  const main = h('div', 'who-main'), start = button('🎬 공개 시작', () => startReveal(v), 'btn primary big');
  start.disabled = !v.answers.length;
  main.append(h('h2', '', '🏆 누가 썼을까'), qs, h('p', 'who-count', `✍️ ${names.length}명이 답했어요 (답 ${v.answers.length}개)`), who, start,
    h('p', 'hint', '다 모이면 ‘공개 시작’을 눌러요. 답을 마감하고 하나씩 띄워요. 진행하는 사람도 답하려면 폰으로 QR을 찍어요.'));
  const wrap = h('div', 'who-wait-grid');
  wrap.append(main, side);
  panel.append(wrap, ownerBtns(v));
  return panel;
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
function ownerBtns(v) {
  const btns = h('div', 'play-btns who-owner');
  if (v.room.closed) btns.append(button('답 더 받기 (다시 열기)', () => whoDb.setClosed(v.id, false).catch(e => toast(errText(e), 3500)), 'btn'));
  btns.append(button('방 지우기', async () => {
    if (!confirm('이 방을 지울까요? 모든 답이 지워져요.')) return;
    try {
      view = null;
      v.stop();
      await whoDb.remove(v.id);
      const reveal = { ...prefs.get().reveal };
      delete reveal[v.id];
      prefs.set({ reveal });
      location.hash = '';
      toast('지웠어요');
    } catch (e) { toast(errText(e), 3500); route(); }
  }, 'btn'));
  return btns;
}
async function startReveal(v) {
  if (!confirm('답을 마감하고 하나씩 공개할까요?')) return;
  try {
    await whoDb.setClosed(v.id, true);
    setReveal(v, { order: revealOrder(v.answers, v.room.questions.length), at: 0, shown: false });
  } catch (e) { toast(errText(e), 3500); }
}
const getReveal = v => prefs.get().reveal[v.id];
function setReveal(v, rv) { prefs.set({ reveal: { ...prefs.get().reveal, [v.id]: rv } }); paint(v); }

// 공개 (큰 화면): 답 하나씩 → 누가 썼을까? → 이름
function revealPanel(v) {
  let rv = getReveal(v);
  if (!rv) { rv = { order: revealOrder(v.answers, v.room.questions.length), at: 0, shown: false }; prefs.set({ reveal: { ...prefs.get().reveal, [v.id]: rv } }); } // 다른 기기에서 마감한 경우
  const byId = new Map(v.answers.map(a => [a.id, a])), order = rv.order.filter(id => byId.has(id)), panel = h('section', 'panel who-panel');
  const at = Math.min(rv.at, order.length);
  if (at < order.length) {
    const a = byId.get(order[at]), card = h('div', `who-card${rv.shown ? ' shown' : ''}`);
    card.append(h('p', 'who-question', `${a.q + 1}. ${v.room.questions[a.q]}`), h('p', 'who-answer', `“${a.text}”`),
      h('p', 'who-name', rv.shown ? `✍️ ${a.name}` : '누가 썼을까요?'));
    const btns = h('div', 'play-btns who-btns'), back = button('‹ 이전', () => setReveal(v, { ...rv, at: at - 1, shown: true }), 'btn');
    back.disabled = !at;
    btns.append(back, rv.shown ? button('다음 →', () => setReveal(v, { ...rv, at: at + 1, shown: false }), 'btn primary big')
      : button('👀 공개', () => { fanfare(); setReveal(v, { ...rv, shown: true }); }, 'btn primary big'));
    panel.append(h('p', 'who-progress', `${at + 1} / ${order.length}`), card, btns);
  } else {
    const all = h('div', 'who-all');
    v.room.questions.forEach((q, i) => {
      const list = v.answers.filter(a => a.q === i);
      if (!list.length) return;
      const sec = h('section'), ul = h('ul');
      for (const a of list) { const li = h('li'); li.append(h('span', '', a.text), h('b', '', a.name)); ul.append(li); }
      sec.append(h('h3', '', `${i + 1}. ${q}`), ul);
      all.append(sec);
    });
    const btns = h('div', 'play-btns');
    btns.append(button('처음부터 다시 보기', () => setReveal(v, { order: revealOrder(v.answers, v.room.questions.length), at: 0, shown: false }), 'btn'));
    panel.append(h('p', 'who-done', '🏁 다 봤어요!'), all, btns);
  }
  panel.append(ownerBtns(v));
  return panel;
}
// 큰 화면 진행용: Enter·→ = 공개/다음, ← = 이전
addEventListener('keydown', e => {
  const v = view;
  if (!v?.room?.isOwner || !v.room.closed || e.target.closest('input, textarea')) return;
  const rv = getReveal(v);
  if (!rv) return;
  if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); if (rv.at < rv.order.length) setReveal(v, rv.shown ? { ...rv, at: rv.at + 1, shown: false } : { ...rv, shown: true }); }
  else if (e.key === 'ArrowLeft' && rv.at > 0) setReveal(v, { ...rv, at: rv.at - 1, shown: true });
});

addEventListener('hashchange', route);
route();
