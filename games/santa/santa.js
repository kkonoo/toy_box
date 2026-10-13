'use strict';
// 시크릿 산타 (주최자 화면): 이름을 적고 매칭하면, 사람마다 자기 결과만 담긴 개인 링크를 만들어 나눠 줌
// 매칭 결과는 이 화면 어디에도 그리지 않음 — 이름 옆에는 링크 복사·공유·QR 단추만
// 링크 # 뒤에 결과가 들어 있어서(santa-core.js encodeCard) 서버 없이 각자 자기 폰에서 me.html로 확인
// 이 기기에는 이름과 마지막 추첨(링크들)을 기억해 두어, 링크를 잃어버린 사람에게 다시 보낼 수 있음
const prefs = store('santa', { names: '', draw: null }); // draw = { code, people: [{ name, card }] }
const done = new Set(); // 이번에 링크를 복사·공유·QR로 보여 준 사람 (표시만, 기억 안 함)

function render() {
  const o = prefs.get();
  $('app').replaceChildren(o.draw ? linksPanel(o.draw) : namesPanel(o.names));
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
  const to = matchSanta(names.length), code = drawCode();
  prefs.set({ draw: { code, people: names.map((name, i) => ({ name, card: encodeCard({ d: code, g: name, r: names[to[i]] }) })) } });
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
    if (confirm('다시 섞으면 이미 보낸 링크는 예전 결과를 그대로 보여 줘요. 모두에게 새 링크를 다시 보내야 해요. 다시 섞을까요?')) makeDraw(draw.people.map(p => p.name));
  }, 'btn');
  const edit = button('이름 고치기', () => {
    if (confirm('이름을 고치면 지금 링크들은 버리고 다시 매칭해요. 고칠까요?')) { prefs.set({ draw: null }); render(); }
  }, 'btn');
  const btns = h('div', 'play-btns');
  btns.append(again, edit);
  panel.append(h('h2', '', `🎄 추첨 #${draw.code} · ${draw.people.length}명`),
    h('p', 'hint', '링크를 각자에게 따로 보내거나, 그 자리에서 QR을 띄워 본인 폰 카메라로 찍게 해요. 받은 사람 화면에도 같은 추첨 번호가 보여요. 주최자도 참가자라면 자기 링크만 열어 보세요.'),
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

render();
