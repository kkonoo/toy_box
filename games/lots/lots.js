'use strict';
// 제비뽑기: n장 중 k장 당첨. 섞을 때 당첨을 미리 정하고(lots-core.js), 한 장씩 눌러서 뒤집기
// 살림노트(everyday_notes) play.js 의 '제비뽑기'에서 가져옴
const prefs = store('lots', { n: 6, k: 1, sound: false });
let busy = false;     // '남은 것 모두 뒤집기' 도는 중: 다시 그리지 않음
let lotsState = null; // { n, k, wins, open: Set }

function render() {
  if (busy) return;
  const o = prefs.get(), n = o.n, k = Math.min(o.k, n - 1);
  if (!lotsState || lotsState.n !== n || lotsState.k !== k) lotsState = { n, k, wins: drawLots(n, k), open: new Set() };
  const panel = h('section', 'panel play-one'), setup = h('div', 'play-setup'), cards = h('div', 'lots'), status = h('p', 'play-status'), btns = h('div', 'play-btns');
  const group = (...xs) => { const g = h('span', 'setup-group'); g.append(...xs); return g; }; // 좁으면 묶음째로 다음 줄
  setup.append(group('모두', stepper(n, 2, 30, v => { prefs.set({ n: v }); render(); }), '장 중'),
    group('당첨', stepper(k, 1, n - 1, v => { prefs.set({ k: v }); render(); }), '장'));
  for (let i = 0; i < n; i++) {
    const c = button('', () => flipLot(i, c), 'lot');
    c.append(h('span', 'lot-back', i + 1), h('span', 'lot-front'));
    if (lotsState.open.has(i)) showLot(i, c);
    cards.append(c);
  }
  status.id = 'lotsStatus';
  status.textContent = lotsText();
  btns.append(button('남은 것 모두 뒤집기', flipAllLots, 'btn'), button('다시 섞기', () => { lotsState = null; render(); }, 'btn'));
  panel.append(setup, h('p', 'hint', '한 장씩 눌러서 뒤집어요.'), cards, status, btns);
  $('app').replaceChildren(panel);
}
function lotsText() {
  const { n, k, wins, open } = lotsState, got = [...open].filter(i => wins[i]).length;
  return got === k ? `당첨 ${k}장이 다 나왔어요 🎉` : `${open.size}/${n}장 뒤집음 · 당첨 ${got}/${k}`;
}
// 뒤집을 때 앞면 글자를 넣음 (뒤집기 전엔 화면 어디에도 당첨이 안 적혀 있게)
function showLot(i, c) {
  const win = lotsState.wins[i];
  c.lastChild.textContent = win ? '🎉 당첨' : '꽝';
  c.classList.toggle('win', win);
  c.classList.add('open');
}
function flipLot(i, c) {
  if (lotsState.open.has(i)) return;
  lotsState.open.add(i);
  showLot(i, c);
  if (lotsState.wins[i]) fanfare(); else beep(330, 60);
  $('lotsStatus').textContent = lotsText();
}
async function flipAllLots() {
  if (busy) return;
  busy = true;
  const cards = [...document.querySelectorAll('#app .lot')];
  for (let i = 0; i < lotsState.n; i++) {
    if (lotsState.open.has(i)) continue;
    flipLot(i, cards[i]);
    await wait(350);
  }
  busy = false;
}

$('headEnd').append(soundButton(prefs));
render();
