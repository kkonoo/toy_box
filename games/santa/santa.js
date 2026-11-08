'use strict';
// 시크릿 산타 (주최자 화면): 이름을 적고 매칭하면, 사람마다 자기 결과만 담긴 개인 링크를 만들어 나눠 줌
// 매칭 결과는 이 화면 어디에도 그리지 않음 — 이름 옆에는 링크 복사·공유·QR 단추만
// 링크 # 뒤에 결과가 들어 있어서(santa-core.js encodeCard) 서버 없이 각자 자기 폰에서 me.html로 확인
// 이 기기에는 이름과 마지막 추첨(링크들)을 기억해 두어, 링크를 잃어버린 사람에게 다시 보낼 수 있음
// 위시리스트 id(santa-core.js wishId)도 이름마다 기억해서, 다시 섞거나 이름을 고쳐도 같은 이름이면 써 둔 위시리스트가 그대로 이어짐
const prefs = store('santa', { names: '', draw: null, wishIds: {}, guess: null }); // draw = { code, people: [{ name, card }] }, wishIds = { 이름: 위시 id }, guess = 선물 주인 맞히기 진행
const done = new Set(); // 이번에 링크를 복사·공유·QR로 보여 준 사람 (표시만, 기억 안 함)

// 주소가 #guess면 선물 주인 맞히기 (크리스마스 모음에서 바로 올 수 있게)
function render() {
  const o = prefs.get();
  if (location.hash === '#guess' && !o.draw) toast('먼저 이름을 적고 매칭해 주세요');
  $('app').replaceChildren(!o.draw ? namesPanel(o.names) : location.hash === '#guess' ? guessPanel(o.draw) : linksPanel(o.draw));
}

// ---------- 1. 이름 적기 ----------
function namesPanel(text) {
  const panel = h('section', 'panel santa-panel'), ta = h('textarea'), info = h('p', 'santa-info'), go = button('매칭하기', () => makeDraw(parseNames(ta.value)), 'btn primary big');
  ta.rows = 9;
  ta.placeholder = '한 줄에 한 명씩 (쉼표로 나눠도 돼요)';
  ta.value = text;
  const check = () => {
    const names = parseNames(ta.value), dup = dupNames(names);
    info.textContent = dup.length ? `겹치는 이름이 있어요: ${dup.join(', ')} — 성이나 별명을 붙여 구분해 주세요`
      : names.length < 3 ? `${names.length}명 · 3명 이상이어야 해요` : `${names.length}명`;
    info.classList.toggle('warn', dup.length > 0);
    go.disabled = names.length < 3 || dup.length > 0;
  };
  ta.addEventListener('input', () => { prefs.set({ names: ta.value }); check(); });
  check();
  panel.append(h('h2', '', '참가자 이름'), ta, info, go,
    h('p', 'hint', '자기 자신은 안 뽑혀요. 매칭 결과는 이 화면에 나오지 않고, 사람마다 자기 결과만 보이는 링크를 나눠 줘요.'));
  return panel;
}
function makeDraw(names) {
  const to = matchSanta(names.length), code = drawCode(), old = prefs.get().wishIds;
  const ids = Object.fromEntries(names.map(name => [name, old[name] || wishId()]));
  prefs.set({ wishIds: ids, draw: { code, people: names.map((name, i) => {
    const r = names[to[i]];
    return { name, card: encodeCard({ d: code, g: name, r, w: ids[name], rw: ids[r] }) };
  }) } });
  done.clear();
  render();
}

// ---------- 2. 링크 나눠 주기 ----------
const linkOf = p => `${new URL('me.html', location.href).href}#${p.card}`;
function linksPanel(draw) {
  const panel = h('section', 'panel santa-panel'), list = h('ul', 'santa-list');
  for (const p of draw.people) {
    const li = h('li', done.has(p.name) ? 'done' : ''), btns = h('span', 'santa-btns');
    const mark = () => { done.add(p.name); li.classList.add('done'); };
    btns.append(button('링크 복사', () => copyLink(p).then(ok => ok && mark()), 'btn small'));
    if (navigator.share) btns.append(button('공유', () => shareLink(p).then(ok => ok && mark()), 'btn small'));
    btns.append(button('QR', () => { showQR(p); mark(); }, 'btn small'));
    li.append(h('span', 'santa-name', p.name), btns);
    list.append(li);
  }
  const again = button('다시 섞기', () => {
    if (confirm('다시 섞으면 이미 보낸 링크는 예전 결과를 그대로 보여 줘요. 모두에게 새 링크를 다시 보내야 해요. 써 둔 위시리스트는 그대로 남아요. 다시 섞을까요?')) makeDraw(draw.people.map(p => p.name));
  }, 'btn');
  const edit = button('이름 고치기', () => {
    if (confirm('이름을 고치면 지금 링크들은 버리고 다시 매칭해요. 고칠까요?')) { prefs.set({ draw: null }); render(); }
  }, 'btn');
  const btns = h('div', 'play-btns');
  btns.append(button('🕵️ 선물 주인 맞히기', () => { location.hash = 'guess'; }, 'btn primary'), again, edit);
  panel.append(h('h2', '', `🎄 추첨 #${draw.code} · ${draw.people.length}명`),
    h('p', 'hint', '링크를 각자에게 따로 보내거나, 그 자리에서 QR을 띄워 본인 폰 카메라로 찍게 해요. 받은 사람 화면에도 같은 추첨 번호가 보여요. 주최자도 참가자라면 자기 링크만 열어 보세요.'),
    h('p', 'hint', '🎁 링크를 연 사람은 위시리스트(갖고 싶은 것·참고 링크)를 써 둘 수 있어요. 안 써도 되고, 쓰면 그 사람을 뽑은 산타 화면에 바로 보여요.'),
    list, btns);
  return panel;
}
async function copyLink(p) {
  const url = linkOf(p);
  try {
    await navigator.clipboard.writeText(url);
    toast(`${p.name}님 링크를 복사했어요`);
    return true;
  } catch {
    prompt(`${p.name}님 링크를 복사해 주세요`, url); // 복사가 안 되는 브라우저
    return true;
  }
}
async function shareLink(p) {
  try {
    await navigator.share({ title: '🎅 시크릿 산타', text: `${p.name}님의 시크릿 산타 결과예요. 혼자 열어 보세요!`, url: linkOf(p) });
    return true;
  } catch { return false; } // 취소
}
// QR: 주최자 화면에 띄우고 본인이 카메라로 찍음 (QR은 사람 눈으로 못 읽으니 주최자도 결과를 모름)
function showQR(p) {
  const qr = qrcode(0, 'M');
  qr.addData(linkOf(p));
  qr.make();
  const n = qr.getModuleCount(), m = 4, s = svg('svg', { class: 'qr', viewBox: `0 0 ${n + m * 2} ${n + m * 2}`, 'shape-rendering': 'crispEdges' });
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
  s.append(svg('rect', { width: n + m * 2, height: n + m * 2, fill: '#fff' }), svg('path', { d, fill: '#000' }));
  $('qrTitle').textContent = `${p.name}님`;
  $('qrBox').replaceChildren(s);
  $('qr').showModal();
}
$('qrClose').addEventListener('click', () => $('qr').close());

// ---------- 3. 선물 주인 맞히기 (파티에서) ----------
// 선물을 한데 모아 두고, 정한 순서대로 한 사람씩 '내 선물을 준 산타'를 찍음. 맞히면 산타 공개, 틀리면 다음 사람. 모두 맞힐 때까지 돎
// 정답은 이 기기에 남은 추첨(링크들)에서 꺼냄 (santa-core.js santaOfDraw). 진행은 이 기기에 기억해서 새로 고쳐도 이어짐
// guess = { code: 추첨 번호, order: 순서, at: 지금 차례 자리, tries: { 이름: [찍은 이름…] }, done: [맞힌 차례대로 이름], ended: 중간에 끝냄 }
let pick = null, last = null; // 지금 고른 이름 · 방금 결과 { name, pick, ok } (화면에만)
function guessState(draw) {
  let g = prefs.get().guess;
  if (!g || g.code !== draw.code) { // 처음이거나 다시 섞었음
    g = { code: draw.code, order: cryptoShuffle(draw.people.map(p => p.name)), at: 0, tries: {}, done: [], ended: false };
    prefs.set({ guess: g });
    pick = last = null;
  }
  return g;
}
function guessPanel(draw) {
  const g = guessState(draw), santaOf = santaOfDraw(draw.people.map(p => decodeCard(p.card)));
  const ok = name => hasGuessed(name, g.tries, santaOf), over = g.ended || g.order.every(ok), now = g.order[g.at];
  const panel = h('section', 'panel santa-panel'), order = h('ol', 'guess-order'), turn = h('div', 'guess-turn');
  g.order.forEach((name, i) => {
    const n = (g.tries[name] || []).length, li = h('li', ok(name) ? 'ok' : !over && i === g.at && !last ? 'now' : '');
    li.append(h('b', '', name), h('small', '', ok(name) ? `✓ ${n}번` : n ? `${n}번` : ''));
    order.append(li);
  });
  if (last) { // 방금 결과
    turn.classList.add(last.ok ? 'right' : 'wrong');
    turn.append(h('p', 'guess-big', last.ok ? '⭕ 맞았어요!' : '❌ 아니에요'),
      h('p', 'guess-sub', last.ok ? `${last.name}님의 산타는 🎅 ${last.pick}님` : `${last.name}님의 산타는 ${last.pick}님이 아니에요`),
      button(over ? '🏁 결과 보기' : `다음: ${now}님 차례 →`, () => { last = null; render(); }, 'btn primary big'));
  } else if (!over) { // 지금 차례: 이름을 고르고 정답 확인
    const names = h('div', 'guess-names'), tried = g.tries[now] || [], can = new Set(guessChoices(now, g.order, g.tries, santaOf));
    const go = button('🔔 정답 확인', () => judge(g, now, santaOf), 'btn primary big');
    if (!can.has(pick)) pick = null;
    for (const x of g.order) {
      if (x === now) continue;
      const b = button(x, () => { pick = x; render(); }, `guess-name${pick === x ? ' on' : ''}${tried.includes(x) ? ' tried' : !can.has(x) ? ' known' : ''}`);
      b.disabled = !can.has(x);
      b.title = tried.includes(x) ? '이미 찍은 사람' : !can.has(x) ? '다른 사람의 산타로 밝혀진 사람' : '';
      names.append(b);
    }
    go.disabled = !pick;
    turn.append(h('p', 'guess-big', `🎁 ${now}님 차례`),
      h('p', 'guess-sub', `${now}님 선물을 준 산타는 누구일까요?${tried.length ? ` (${tried.length + 1}번째)` : ''}`), names, go);
  } else { // 끝
    const left = g.order.filter(x => !ok(x)), end = g.done[g.done.length - 1], once = g.order.filter(x => ok(x) && g.tries[x].length === 1);
    turn.append(h('p', 'guess-big', left.length ? '🏁 끝!' : '🏁 모두 맞혔어요!'),
      h('p', 'guess-sub', left.length ? `🐢 끝까지 못 맞힌 사람: ${left.join(', ')}` : `🐢 끝까지 남은 사람: ${end} (${g.tries[end].length}번 만에)`));
    if (once.length) turn.append(h('p', 'guess-sub', `🎯 한 번에 맞힌 사람: ${once.join(', ')}`));
  }
  const table = h('table', 'guess-table'), head = h('tr');
  head.append(h('th', '', '이름'), h('th', '', '찍은 횟수'), h('th', '', '산타'));
  table.append(head);
  for (const r of guessTable(g.order, g.tries, santaOf)) {
    const tr = h('tr', r.ok ? 'ok' : '');
    tr.append(h('td', '', r.name), h('td', '', r.ok ? `${r.n}번 만에 ⭕` : `${r.n}번${over ? ' · 못 맞힘' : ''}`),
      h('td', '', r.ok || over ? `🎅 ${santaOf[r.name]}` : '?'));
    table.append(tr);
  }
  const btns = h('div', 'play-btns');
  btns.append(button('‹ 링크 화면', () => { location.hash = ''; }, 'btn'));
  if (!over) btns.append(button('그만하고 모두 공개', () => {
    if (confirm('아직 못 맞힌 사람의 산타까지 모두 공개할까요?')) { prefs.set({ guess: { ...g, ended: true } }); last = null; render(); }
  }, 'btn'));
  btns.append(button('처음부터 다시', () => {
    if (confirm('기록을 지우고 순서를 새로 섞어 처음부터 할까요?')) { prefs.set({ guess: null }); render(); }
  }, 'btn'));
  panel.append(h('h2', '', `🕵️ 선물 주인 맞히기 · 추첨 #${draw.code}`),
    h('p', 'hint', '선물을 한데 모아 두고, 차례가 된 사람이 ‘내 선물을 준 산타’를 찍어요. 맞히면 산타가 공개되고, 틀리면 다음 사람으로 넘어가요. 모두 맞힐 때까지 돌아요.'),
    order, turn, table, btns);
  return panel;
}
function judge(g, name, santaOf) {
  const tries = { ...g.tries, [name]: [...(g.tries[name] || []), pick] }, ok = santaOf[name] === pick, at = nextGuesser(g.order, g.at, tries, santaOf);
  prefs.set({ guess: { ...g, tries, at: at < 0 ? g.at : at, done: ok ? [...g.done, name] : g.done } });
  last = { name, pick, ok };
  pick = null;
  if (ok) fanfare(); else buzz(60);
  render();
}

addEventListener('hashchange', render);
render();
