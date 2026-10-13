'use strict';
// 룰렛: 항목을 직접 적고, 자주 쓰는 목록은 저장해 두고 불러오기 (이 기기에만)
// 칸은 wheel-core.js 가 crypto 난수로 먼저 뽑고(spinWheel), 판은 그 각도까지 돌기만 함 → 멈춘 칸 = 발표 결과
// 살림노트(everyday_notes) play.js 의 '룰렛'에서 가져옴
const WHEEL_MAX = 24; // 판의 칸 수
// 칸 색: 프로젝터에서도 구분되게 살림노트 노트 색보다 조금 진하게
const WHEEL_COLORS = ['#F27E72', '#F6A660', '#F2C94C', '#86C46F', '#55C2A2', '#5DBBD8', '#7AA2F0', '#A889EC', '#EE8BBB', '#BDB4A6'];
const prefs = store('wheel', { items: '', lists: [], sound: false });
let busy = false; // 돌아가는 중: 다시 그리지 않음. 끝나면 다시 그림
const wheelState = { rot: 0, board: '', result: null }; // 판 각도·마지막 결과
const parseList = v => [...new Set(v.split(/[\n,]/).map(s => s.trim()).filter(Boolean))]; // 쉼표·줄바꿈으로, 겹치는 것 빼고

function render() {
  if (busy) return;
  const o = prefs.get(), grid = h('div', 'play-grid'), stage = h('section', 'panel play-stage'), side = h('section', 'panel play-side');
  stage.id = 'playStage';
  const ta = h('textarea'), hint = h('p', 'hint');
  ta.rows = 6;
  ta.placeholder = '쉼표나 줄바꿈으로 (예: 짜장면, 짬뽕, 탕수육)';
  ta.value = o.items;
  ta.addEventListener('input', () => { prefs.set({ items: ta.value }); paintWheel(); }); // 판만 다시 (입력 칸은 그대로 → 한글 조합이 안 끊기게)
  hint.id = 'wheelHint';
  const lists = h('div', 'pills saved-lists');
  lists.append(...o.lists.map(l => {
    const b = button(l.name, () => { prefs.set({ items: l.items.join('\n') }); render(); });
    b.title = `${l.items.join(', ')}\n누르면 불러오기 · 길게 누르면(PC는 오른쪽 클릭) 지우기`;
    holdPress(b, () => {
      if (!confirm(`‘${l.name}’ 목록을 지울까요?`)) return;
      prefs.set({ lists: prefs.get().lists.filter(x => x.name !== l.name) });
      render();
    });
    return b;
  }));
  const head = (title, ...extra) => { const d = h('div', 'panel-head'); d.append(h('h2', '', title), ...extra); return d; };
  side.append(head('항목'), ta, hint, head('저장한 목록', button('＋ 지금 항목 저장', saveWheelList, 'btn small')),
    o.lists.length ? lists : h('p', 'hint', '자주 쓰는 항목은 저장해 두고 눌러서 불러와요. 이 기기에만 저장돼요.'));
  grid.append(stage, side);
  $('app').replaceChildren(grid);
  paintWheel();
}
function paintWheel() {
  if (busy) return;
  const all = parseList(prefs.get().items);
  $('playStage').replaceChildren(wheelBox(all.slice(0, WHEEL_MAX)));
  $('wheelHint').textContent = all.length > WHEEL_MAX ? `판에는 ${WHEEL_MAX}개까지만 올려요 (지금 ${all.length}개)` : '';
}

// ---------- 룰렛 판 ----------
// names 순서 = 판의 칸 순서 (맨 위에서 시계 방향)
function wheelBox(names) {
  const st = wheelState, box = h('div', 'wheel-box'), wrap = h('div', 'wheel-wrap'), disc = h('div', 'wheel'), out = h('div', 'wheel-result');
  const board = names.join('\n');
  if (st.board !== board) { st.board = board; st.result = null; } // 판이 바뀌면 지난 결과는 지움
  disc.style.transform = `rotate(${st.rot}deg)`;
  disc.append(wheelSvg(names));
  wrap.append(h('span', 'wheel-pointer'), disc);
  const go = button(st.result ? '다시 돌리기' : '돌리기', () => spinBoard(names, disc, go, out), 'btn primary spin-btn');
  go.disabled = names.length < 2;
  if (st.result) {
    const r = h('div', 'result');
    r.append(h('p', 'result-text', `🎉 ${st.result}`));
    out.append(r);
  } else if (names.length < 2) out.append(h('p', 'hint', '항목이 2개 이상 있어야 돌릴 수 있어요'));
  box.append(wrap, go, out);
  return box;
}
// 칸 i = 위(0°)에서 시계 방향으로 i·s ~ (i+1)·s 도 (wheel-core.js sliceAt과 같은 기준)
function wheelSvg(names) {
  const n = names.length, S = 300, c = S / 2, r = c - 3, s = svg('svg', { class: 'wheel-svg', viewBox: `0 0 ${S} ${S}` });
  if (n < 2) {
    s.append(svg('circle', { class: 'wheel-empty', cx: c, cy: c, r: r - 2 }));
    return s;
  }
  const step = 360 / n, fs = n <= 6 ? 16 : n <= 10 ? 14 : n <= 16 ? 12 : 10;
  const pt = deg => [c + r * Math.sin(deg * Math.PI / 180), c - r * Math.cos(deg * Math.PI / 180)];
  const L = WHEEL_COLORS.length;
  names.forEach((name, i) => {
    const [x1, y1] = pt(i * step), [x2, y2] = pt((i + 1) * step);
    const color = WHEEL_COLORS[i === n - 1 && i % L === 0 ? 1 : i % L]; // 마지막 칸이 첫 칸과 같은 색이면 다음 색
    s.append(svg('path', { d: `M${c},${c}L${x1.toFixed(2)},${y1.toFixed(2)}A${r},${r} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}Z`, fill: color, 'data-i': i }));
    // 글자는 칸 가운데 줄을 따라 바깥쪽 끝에서. 왼쪽 절반은 뒤집히지 않게 반대로 돌려서 바깥 → 안쪽으로
    const mid = i * step + step / 2, left = mid > 180;
    const t = svg('text', { x: left ? c - r + 12 : c + r - 12, y: c, transform: `rotate(${left ? mid + 90 : mid - 90} ${c} ${c})`, 'font-size': fs, class: left ? 'left' : '' });
    t.textContent = name.length > 7 ? `${name.slice(0, 6)}…` : name;
    s.append(t);
  });
  s.append(svg('circle', { class: 'wheel-hub', cx: c, cy: c, r: 14 }));
  return s;
}
// 돌리기: 칸을 먼저 뽑고(spinWheel) 판을 그 각도까지 돌린 뒤, 같은 칸 이름을 결과로
function spinBoard(names, disc, go, out) {
  if (busy || names.length < 2) return;
  const st = wheelState, { index, rotation } = spinWheel(names.length, st.rot), ms = reduceMotion() ? 600 : 4200;
  busy = true;
  st.result = null;
  go.disabled = true;
  out.replaceChildren();
  disc.style.transition = `transform ${ms}ms cubic-bezier(.15, .6, .1, 1)`;
  disc.style.transform = `rotate(${rotation}deg)`;
  st.rot = rotation;
  if (sound.on) tickWhile(disc, names.length, ms);
  setTimeout(() => {
    st.result = names[index];
    busy = false;
    fanfare();
    render();
  }, ms + 50);
}
// 소리를 켰으면 칸이 바늘을 지날 때마다 틱
function tickWhile(disc, n, ms) {
  const end = performance.now() + ms;
  let last = null;
  const f = () => {
    try {
      const m = new DOMMatrix(getComputedStyle(disc).transform), i = sliceAt(Math.atan2(m.b, m.a) * 180 / Math.PI, n);
      if (last !== null && i !== last) beep(1400, 12, 0.03);
      last = i;
    } catch { return; }
    if (performance.now() < end) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

// ---------- 저장한 목록 ----------
async function saveWheelList() {
  const items = parseList(prefs.get().items);
  if (items.length < 2) { toast('항목을 2개 이상 적어 주세요'); return; }
  const name = await ask('목록 이름 (예: 점심 메뉴)');
  if (!name) return;
  const lists = prefs.get().lists;
  if (lists.some(l => l.name === name) && !confirm(`‘${name}’ 목록을 지금 항목으로 바꿀까요?`)) return;
  prefs.set({ lists: [...lists.filter(l => l.name !== name), { name, items }] });
  render();
  toast(`‘${name}’ 목록을 저장했어요`);
}
// prompt() 대신: 페이지 안 창이라 PC에서 Enter = 확인. 적은 이름(앞뒤 공백 뺌), 취소·Esc면 ''
let askDone = () => {};
function ask(label, value = '') {
  $('askLabel').textContent = label;
  $('askInput').value = value;
  $('ask').showModal();
  $('askInput').select();
  return new Promise(res => { askDone = v => { askDone = () => {}; res(v); }; });
}
$('askForm').addEventListener('submit', e => { e.preventDefault(); $('ask').close(); askDone($('askInput').value.trim()); });
$('askCancel').addEventListener('click', () => $('ask').close());
$('ask').addEventListener('close', () => { if (!$('ask').open) askDone(''); }); // close는 늦게 옴: 그새 다시 연 창은 그대로
// 단추 길게 누르기 (0.5초, 터치·마우스 공통) 또는 오른쪽 클릭 → fn.
// 그 뒤 손을 뗄 때 오는 click·contextmenu(폰은 길게 누르면 옴)는 다음에 누를 때까지 막음 — fn이 다시 그려서 그 자리에 다른 단추가 와도
function holdPress(el, fn) {
  let timer = null;
  const types = ['click', 'contextmenu'], block = e => { e.preventDefault(); e.stopPropagation(); };
  const fire = () => {
    clearTimeout(timer);
    types.forEach(t => addEventListener(t, block, true));
    addEventListener('pointerdown', () => types.forEach(t => removeEventListener(t, block, true)), { capture: true, once: true });
    fn();
  };
  el.addEventListener('pointerdown', e => { if (e.button === 0) timer = setTimeout(fire, 500); });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(t, () => clearTimeout(timer));
  el.addEventListener('contextmenu', e => { e.preventDefault(); fire(); });
}

$('headEnd').append(soundButton(prefs));
render();
