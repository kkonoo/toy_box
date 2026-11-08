'use strict';
// 몸으로 말해요 (폰 한 대): 설명하는 사람이 폰을 들고, 나온 낱말을 말없이 몸으로 설명 → 같은 팀이 맞히면 ⭕, 어려우면 ⏭
// 정한 시간이 끝나면 몇 개 맞혔는지와 낱말 목록. 판마다 몇 개였는지 남겨서 팀끼리 견줌 (낱말은 charades-core.js)
const prefs = store('charades', { cats: ['xmas', 'act'], secs: 60, sound: true, rounds: [] }); // rounds = 지난 판 맞힌 개수 (최근 순)
const ROUNDS_MAX = 12;
const used = new Set(); // 이번에 나온 낱말 (같은 낱말이 또 안 나오게, 이 탭에서만)
let phase = 'ready', deck = [], word = '', results = [], endAt = 0, timer = null, wakeLock = null;

function render() {
  const o = prefs.get(), app = $('app');
  document.body.dataset.phase = phase;
  if (phase === 'ready') {
    const cats = h('div', 'pills cats'), secs = h('div', 'seg'), past = h('p', 'past');
    for (const [k, label] of CATS) {
      const on = o.cats.includes(k);
      cats.append(button(label, () => {
        const next = on ? o.cats.filter(x => x !== k) : [...o.cats, k];
        if (next.length) { prefs.set({ cats: next }); render(); }
      }, on ? 'on' : ''));
    }
    for (const s of [60, 90, 120]) secs.append(button(`${s}초`, () => { prefs.set({ secs: s }); render(); }, o.secs === s ? 'on' : ''));
    if (o.rounds.length) {
      past.append(`지난 판: ${[...o.rounds].reverse().map((n, i) => `${i + 1}판 ${n}개`).join(' · ')} `,
        button('지우기', () => { prefs.set({ rounds: [] }); render(); }, 'btn small'));
    }
    app.replaceChildren(h('div', 'face', '🙆'), h('p', 'lead', '폰을 든 사람이 낱말을 말없이 몸으로 설명하고,\n같은 팀이 맞혀요!'),
      cats, secs, button('시작', countdown, 'btn primary big'), past,
      h('p', 'hint', '맞히면 ⭕, 너무 어려우면 ⏭ 넘기기. 갈래는 여러 개 골라도 돼요.'));
  } else if (phase === 'count') {
    app.replaceChildren(h('div', 'count', ''));
  } else if (phase === 'run') {
    const bar = h('div', 'bar'), left = h('span', 'left'), skip = button('⏭ 넘기기', () => next(false), 'btn big'), hit = button('⭕ 맞혔어요', () => next(true), 'btn primary big');
    bar.append(h('i'));
    const top = h('div', 'run-top');
    top.append(left, h('span', 'score', `⭕ ${results.filter(r => r.ok).length}`), button('그만', finish, 'btn small'));
    const btns = h('div', 'run-btns');
    btns.append(skip, hit);
    const head = h('div', 'run-head');
    head.append(top, bar);
    app.replaceChildren(head, h('p', 'word', word), btns);
    paintTime();
  } else {
    const n = results.filter(r => r.ok).length, list = h('ul', 'done-list');
    for (const r of results) list.append(h('li', r.ok ? 'ok' : '', `${r.ok ? '⭕' : '⏭'} ${r.word}`));
    const again = button('다음 팀 준비', () => { phase = 'ready'; render(); }, 'btn primary big');
    again.disabled = true; // 넘겨받다 잘못 누르지 않게 잠깐
    setTimeout(() => { again.disabled = false; }, 1000);
    app.replaceChildren(h('p', 'end-title', '⏰ 끝!'), h('p', 'end-score', `${n}개 맞혔어요`), list, again);
  }
}

function countdown() {
  try { audioCtx(); } catch { /* 소리를 못 내는 브라우저 */ } // 누른 순간에 소리를 열어 둠 (폰)
  phase = 'count';
  render();
  keepAwake();
  let k = 3;
  const step = () => {
    if (phase !== 'count') return;
    if (k === 0) return startRound();
    document.querySelector('.count').textContent = k;
    beep(660, 80);
    k--;
    setTimeout(step, 800);
  };
  step();
}
function startRound() {
  deck = charadesDeck(prefs.get().cats, used);
  results = [];
  phase = 'run';
  endAt = Date.now() + prefs.get().secs * 1000; // Date.now: 화면이 잠깐 꺼져도 실제 시간 기준
  draw();
  timer = setInterval(paintTime, 200);
  beep(990, 160);
}
function draw() {
  if (!deck.length) deck = charadesDeck(prefs.get().cats, used); // 다 썼으면 다시 섞음
  word = deck.pop();
  used.add(word);
  render();
}
function next(ok) {
  results.push({ word, ok });
  if (ok) { beep(880, 90); buzz(40); } else beep(330, 90);
  draw();
}
let lastSec = 0;
function paintTime() {
  const ms = endAt - Date.now(), total = prefs.get().secs * 1000;
  if (ms <= 0) return finish();
  const sec = Math.ceil(ms / 1000), left = document.querySelector('.left'), bar = document.querySelector('.bar i');
  if (left) left.textContent = `${sec}초`;
  if (bar) bar.style.width = `${(ms / total) * 100}%`;
  document.body.classList.toggle('hurry', sec <= 5);
  if (sec <= 5 && sec !== lastSec) beep(1200, 40, 0.05, 'square');
  lastSec = sec;
}
function finish() {
  if (phase !== 'run') return;
  clearInterval(timer);
  document.body.classList.remove('hurry');
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  prefs.set({ rounds: [results.filter(r => r.ok).length, ...prefs.get().rounds].slice(0, ROUNDS_MAX) });
  phase = 'end';
  buzz([200, 100, 200]);
  beep(520, 300);
  render();
}
// 하는 동안 화면이 꺼지지 않게 (되는 브라우저만, 폭탄 돌리기와 같음)
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && phase === 'run') { keepAwake(); paintTime(); }
});

$('headEnd').append(soundButton(prefs));
render();
