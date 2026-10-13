'use strict';
// 사다리타기: 이름 n개(2~12, 기본 8), 결과 n개. 사다리를 먼저 만들고, 이름을 누르면 그 길(traceLadder)을 따라 내려감
// 길은 ladder-core.js(makeLadder·traceLadder, crypto 난수)가 정하고, 화면은 그 길을 그리기만 함 → 선이 닿은 칸 = 발표 결과
// 살림노트(everyday_notes) play.js 의 '사다리'에서 가져옴
const LADDER_MIN = 2, LADDER_MAX = 12;
// 참가자 색 (길·이름·결과): 12명까지 서로 구분되게
const LADDER_COLORS = ['#7E6FB5', '#E0896F', '#5B8A5F', '#4F7DA6', '#D9A13B', '#E5484D', '#3B78F0', '#B99AF0', '#1FA3A8', '#C2477F', '#8A6A3C', '#7E9C1A'];
const ladderColor = i => LADDER_COLORS[i % LADDER_COLORS.length];
const prefs = store('ladder', { n: 8, people: [], prizes: [], sound: false });
let busy = false;       // 내려가는 중: 다시 그리지 않음. 끝나면 다시 그림
let ladderState = null; // { lad, people, prizes, shown: Set (사다리를 탄 참가자, 탄 순서), X, Y }

function render() {
  if (busy) return;
  const o = prefs.get(), st = ladderState, n = st ? st.lad.n : Math.min(LADDER_MAX, Math.max(LADDER_MIN, o.n)), panel = h('section', 'panel play-one'), btns = h('div', 'play-btns');
  const row = cls => { const r = h('div', cls); r.style.setProperty('--n', n); return r; };
  const top = row('ladder-names'), bottom = row('ladder-prizes'), box = h('div', 'ladder-box');
  box.id = 'ladderBox';
  if (!st) { // 이름·결과 적기
    const setup = h('div', 'play-setup'), cell = (list, i, ph, field) => {
      const a = h('input');
      a.value = list[i] || '';
      a.placeholder = ph;
      a.autocomplete = 'off';
      a.addEventListener('input', () => { const v = [...prefs.get()[field]]; v[i] = a.value; prefs.set({ [field]: v }); });
      return a;
    };
    setup.append(h('span', '', '참가자'), stepper(n, LADDER_MIN, LADDER_MAX, v => { prefs.set({ n: v }); render(); }), h('span', '', '명'));
    for (let i = 0; i < n; i++) { top.append(cell(o.people, i, `${i + 1}번`, 'people')); bottom.append(cell(o.prizes, i, '꽝', 'prizes')); }
    box.append(h('div', 'ladder-blank', '?'));
    btns.append(button('사다리 만들기', () => {
      const p = prefs.get(), pick = (list, i, d) => (list[i] || '').trim() || d;
      ladderState = {
        lad: makeLadder(n), shown: new Set(),
        people: Array.from({ length: n }, (_, i) => pick(p.people, i, `${i + 1}번`)),
        prizes: Array.from({ length: n }, (_, i) => pick(p.prizes, i, '꽝')),
      };
      render();
    }, 'btn primary'));
    panel.append(setup, h('p', 'hint', '위에는 이름, 아래에는 결과를 적어요. 빈칸은 ‘1번…’, ‘꽝’이에요.'), top, box, bottom, btns);
    $('app').replaceChildren(panel);
    return;
  }
  // 사다리 타기: 이름을 누르면 내려감. 결과는 탄 사람 것만 보임
  st.people.forEach((p, i) => {
    const b = button(p, () => rideLadder(i), st.shown.has(i) ? 'done' : '');
    b.style.setProperty('--lc', ladderColor(i));
    b.title = '눌러서 사다리 타기';
    top.append(b);
  });
  for (let e = 0; e < n; e++) {
    const who = [...st.shown].find(i => traceLadder(st.lad, i).end === e), cell = h('span', who == null ? 'hidden' : 'shown', who == null ? '?' : st.prizes[e]);
    cell.dataset.col = e;
    if (who != null) cell.style.setProperty('--lc', ladderColor(who));
    bottom.append(cell);
  }
  const results = h('ol', 'ladder-results');
  results.id = 'ladderResults';
  for (const i of st.shown) results.append(ladderLine(i));
  btns.append(button('모두 보기', rideAll, 'btn primary'), button('새 사다리', () => {
    ladderState = { ...st, lad: makeLadder(n), shown: new Set() };
    render();
  }, 'btn'), button('이름·결과 고치기', () => { ladderState = null; render(); }, 'btn'));
  if (!st.shown.size) panel.append(h('p', 'hint', '이름을 누르면 사다리를 타요.'));
  panel.append(top, box, bottom, results, btns);
  $('app').replaceChildren(panel);
  drawLadder();
}
const ladderLine = i => {
  const st = ladderState, li = h('li', '', `${st.people[i]} → ${st.prizes[traceLadder(st.lad, i).end]}`);
  li.style.setProperty('--lc', ladderColor(i));
  return li;
};
// 사다리 그림: 세로줄·가로줄 (+ 이미 탄 길). 이름·결과 칸(같은 너비 n칸)의 가운데에 세로줄
// 줄 간격은 폰·노트북은 24px, 큰 화면에선 남는 높이에 맞춰 48px까지
function drawLadder() {
  const st = ladderState, box = $('ladderBox'), n = st.lad.n, W = box.clientWidth || 320;
  const RH = Math.round(Math.min(48, Math.max(24, (innerHeight - 380) / (st.lad.rows + 1)))), H = (st.lad.rows + 1) * RH;
  st.X = c => (c + 0.5) * W / n;
  st.Y = r => (r < 0 ? 0 : r >= st.lad.rows ? H : (r + 1) * RH);
  const s = svg('svg', { class: 'ladder', width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  for (let c = 0; c < n; c++) s.append(svg('line', { class: 'rail', x1: st.X(c), x2: st.X(c), y1: 0, y2: H }));
  st.lad.rungs.forEach((row, r) => row.forEach(c => s.append(svg('line', { class: 'rung', x1: st.X(c), x2: st.X(c + 1), y1: st.Y(r), y2: st.Y(r) }))));
  for (const i of st.shown) s.append(ladderTrail(i));
  box.replaceChildren(s);
}
function ladderTrail(i) {
  const st = ladderState, t = svg('polyline', { class: 'trail', points: traceLadder(st.lad, i).path.map(([c, r]) => `${st.X(c)},${st.Y(r)}`).join(' ') });
  t.style.stroke = ladderColor(i);
  return t;
}
// 길을 그려 내려간 뒤 그 길이 닿은 결과를 보여 줌 (같은 traceLadder 값)
async function rideTrail(i, ms) {
  const st = ladderState, t = ladderTrail(i), end = traceLadder(st.lad, i).end;
  ms = reduceMotion() ? 300 : ms;
  $('ladderBox').firstChild.append(t);
  const len = t.getTotalLength();
  t.style.strokeDasharray = len;
  t.style.strokeDashoffset = len;
  t.getBoundingClientRect(); // 시작 상태를 먼저 적용해야 움직임이 보임
  t.style.transition = `stroke-dashoffset ${ms}ms linear`;
  t.style.strokeDashoffset = 0;
  await wait(ms + 40);
  st.shown.add(i);
  const cell = document.querySelector(`#ladderBox + .ladder-prizes [data-col="${end}"]`);
  cell.textContent = st.prizes[end];
  cell.className = 'shown';
  cell.style.setProperty('--lc', ladderColor(i));
  $('ladderResults').append(ladderLine(i));
  fanfare();
}
async function rideLadder(i) {
  if (busy || ladderState.shown.has(i)) return;
  busy = true;
  await rideTrail(i, 1800);
  busy = false;
  render();
}
async function rideAll() {
  if (busy) return;
  busy = true;
  for (let i = 0; i < ladderState.lad.n; i++) if (!ladderState.shown.has(i)) await rideTrail(i, 900);
  busy = false;
  render();
}

// 창 크기가 바뀌면(노트북을 프로젝터에 연결 등) 세로줄이 이름 칸 가운데에 오게 다시 그림
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (ladderState) render(); }, 200); });

$('headEnd').append(soundButton(prefs));
render();
