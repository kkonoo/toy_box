'use strict';
// 폭탄 돌리기 (폰 한 대): 시작하면 남은 시간이 안 보이는 타이머가 돌고, 폰을 옆 사람에게 넘기다가 터질 때 들고 있던 사람이 걸림
// 터지는 때는 시작할 때 bomb-core.js(fuseMs, crypto 난수)로 정하고 이 파일 안 변수(endAt)에만 둠 — 화면·페이지 어디에도 안 씀
// 째깍 소리·흔들림은 끝까지 같은 빠르기 (빨라지면 남은 시간이 짐작돼서)
const TICK_MS = 500;
const prefs = store('bomb', { fuse: 'normal', sound: true }); // 폭탄은 째깍 소리가 핵심이라 소리 기본 켬
let phase = 'ready'; // ready(고르기) → run(돌리는 중) → boom(터짐)
let endAt = 0, ticks = 0, tickTimer = null, boomTimer = null, wakeLock = null;

function render() {
  const o = prefs.get(), app = $('app');
  document.body.dataset.phase = phase;
  if (phase === 'ready') {
    const seg = h('div', 'seg fuse-seg');
    for (const [k, f] of Object.entries(FUSES)) {
      const b = button('', () => { prefs.set({ fuse: k }); render(); }, k === o.fuse ? 'on' : '');
      b.append(h('b', '', f.name), h('small', '', `${f.min}–${f.max}초`));
      seg.append(b);
    }
    app.replaceChildren(h('div', 'bomb-face', '💣'),
      h('p', 'bomb-lead', '시작하면 폰을 옆 사람에게 넘겨요.\n터질 때 들고 있는 사람이 걸려요!'),
      seg, button('시작', start, 'btn primary big'),
      h('p', 'hint', '언제 터질지는 화면 어디에도 안 나와요. 아이폰은 무음 모드면 소리가 안 날 수 있어요.'));
  } else if (phase === 'run') {
    const face = h('div', 'bomb-face lit', '💣'), stop = button('', null, 'btn small stop-btn');
    face.id = 'bombFace';
    stop.append(h('span', '', '길게 눌러서 그만하기'));
    holdToStop(stop);
    app.replaceChildren(face, h('p', 'bomb-pass', '넘겨요! 👉'), stop);
  } else {
    const again = button('다시 하기', () => { phase = 'ready'; render(); }, 'btn big again-btn');
    again.disabled = true; // 받다가 잘못 누르지 않게 잠깐 막음
    setTimeout(() => { again.disabled = false; }, 1200);
    app.replaceChildren(h('div', 'boom-face', '💥'), h('p', 'boom-text', '펑!'), h('p', 'boom-sub', '지금 들고 있는 사람이 걸렸어요'), again);
  }
}

function start() {
  try { audioCtx(); } catch { /* 소리를 못 내는 브라우저 */ } // 누른 순간에 소리를 열어 둠 (폰)
  phase = 'run';
  ticks = 0;
  endAt = Date.now() + fuseMs(FUSES[prefs.get().fuse] || FUSES.normal); // Date.now: 화면이 잠깐 꺼져도 실제 시간 기준
  boomTimer = setTimeout(boom, endAt - Date.now());
  tickTimer = setInterval(tick, TICK_MS);
  keepAwake();
  render();
  tick();
}
function tick() {
  if (Date.now() >= endAt) return boom();
  ticks++;
  beep(ticks % 2 ? 1000 : 760, 28, 0.08, 'square');
  const face = $('bombFace');
  if (face) { face.classList.remove('tick'); void face.offsetWidth; face.classList.add('tick'); } // 째깍마다 살짝 흔들림
}
function stopTimers() {
  clearTimeout(boomTimer);
  clearInterval(tickTimer);
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
function boom() {
  if (phase !== 'run') return;
  stopTimers();
  phase = 'boom';
  buzz([400, 100, 400, 100, 900]);
  boomSound();
  render();
}
// 펑: 잡음을 낮은 쪽으로 걸러 가며 줄이고, 아래에 낮은 '쿵'을 깔아 줌 (소리 파일 없이)
function boomSound() {
  if (!sound.on) return;
  try {
    const a = audioCtx(), t = a.currentTime, len = 1.6;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = a.createBufferSource(), lp = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + len);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(lp).connect(g).connect(a.destination);
    src.start(t);
    const o = a.createOscillator(), og = a.createGain();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    og.gain.setValueAtTime(0.8, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(og).connect(a.destination);
    o.start(t);
    o.stop(t + 0.7);
  } catch { /* 소리를 못 내는 브라우저 */ }
}

// 넘기는 동안 화면이 꺼지지 않게 (되는 브라우저만). 다른 앱에 다녀오면 풀리므로 돌아올 때 다시
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || phase !== 'run') return;
  if (Date.now() >= endAt) boom(); else keepAwake();
});
// 그만하기: 1초 꾹 눌러야 멈춤 (넘기다 스쳐도 안 멈추게)
function holdToStop(b) {
  let timer = null;
  const cancel = () => { clearTimeout(timer); b.classList.remove('holding'); };
  b.addEventListener('pointerdown', () => {
    b.classList.add('holding');
    timer = setTimeout(() => { cancel(); stopTimers(); phase = 'ready'; render(); }, 1000);
  });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(t, cancel);
  b.addEventListener('contextmenu', e => e.preventDefault());
}

$('headEnd').append(soundButton(prefs));
render();
