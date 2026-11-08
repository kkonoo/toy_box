'use strict';
// 초성 퀴즈 (큰 화면): 캐럴·영화·겨울 간식·크리스마스 낱말의 초성을 띄우고, 먼저 외친 팀에 점수
// 💡 힌트는 앞 글자부터 하나씩 풀어 줌. 점수·지금 문제·낸 문제는 이 기기에 기억 (새로 고쳐도 이어짐)
const TEAMS = [['🔴', '빨강팀'], ['🟢', '초록팀'], ['🔵', '파랑팀'], ['🟡', '노랑팀']];
const prefs = store('chosung', { cats: QUIZ.map(q => q[0]), teams: 2, scores: [], used: [], cur: null, hint: 0, shown: false, n: 0, phase: 'setup', sound: false });
const catLabel = key => QUIZ.find(q => q[0] === key)[1];

function render() {
  const o = prefs.get();
  $('app').replaceChildren(o.phase === 'play' && o.cur ? playPanel(o) : o.phase === 'end' ? endPanel(o) : setupPanel(o));
}

// ---------- 준비 ----------
function setupPanel(o) {
  const panel = h('section', 'panel quiz-panel'), cats = h('div', 'pills quiz-cats'), teams = h('div', 'seg');
  for (const [k, label, list] of QUIZ) {
    const on = o.cats.includes(k);
    cats.append(button(`${label} ${list.length}`, () => {
      const next = on ? o.cats.filter(x => x !== k) : [...o.cats, k];
      if (next.length) { prefs.set({ cats: next }); render(); }
    }, on ? 'on' : ''));
  }
  for (const n of [2, 3, 4]) teams.append(button(`${n}팀`, () => { prefs.set({ teams: n }); render(); }, o.teams === n ? 'on' : ''));
  panel.append(h('h2', '', '문제 갈래'), cats, h('h2', '', '팀'), teams,
    button('시작', () => { prefs.set({ phase: 'play', scores: Array(prefs.get().teams).fill(0), n: 0 }); next(); }, 'btn primary big'),
    h('p', 'hint', '화면에 초성이 나오면 먼저 외친 팀이 맞혀요. 맞힌 팀의 ＋1을 누르면 정답이 나와요. 어려우면 💡 힌트로 앞 글자부터 하나씩 풀어 줘요.'));
  return panel;
}

// ---------- 하기 ----------
function playPanel(o) {
  const panel = h('section', 'panel quiz-panel'), { answer, key } = o.cur, max = syllables(answer) - 1;
  const top = h('div', 'quiz-top');
  top.append(h('span', '', `${o.n}번 문제 · ${catLabel(key)}`), h('span', '', `${syllables(answer)}글자${o.hint ? ` · 힌트 ${o.hint}` : ''}`));
  const q = h('p', `quiz-q${o.shown ? ' shown' : ''}`, o.shown ? answer : hintText(answer, o.hint));
  const btns = h('div', 'play-btns quiz-btns'), hintBtn = button('💡 힌트', hint, 'btn'), showBtn = button('👀 정답 보기', show, 'btn');
  hintBtn.disabled = o.shown || o.hint >= max;
  showBtn.disabled = o.shown;
  btns.append(hintBtn, showBtn, button('다음 문제 →', next, 'btn primary'));
  const board = h('div', 'quiz-board');
  o.scores.forEach((s, i) => {
    const t = h('div', 'quiz-team'), row = h('div', 'quiz-team-btns'), minus = button('−1', () => score(i, -1), 'btn small');
    minus.disabled = !s;
    row.append(minus, button('＋1', () => score(i, 1), 'btn primary'));
    t.append(h('span', 'quiz-team-name', TEAMS[i].join(' ')), h('b', 'quiz-score', s), row);
    board.append(t);
  });
  const end = h('div', 'play-btns');
  end.append(button('🏁 끝내기', () => { prefs.set({ phase: 'end' }); fanfare(); render(); }, 'btn'));
  panel.append(top, q, btns, board, end, h('p', 'hint quiz-keys', `⌨️ H 힌트 · Enter 정답 · → 다음 · 1~${o.scores.length} 팀 ＋1`));
  return panel;
}
function next() {
  const o = prefs.get(), q = quizDeck(o.cats, o.used)[0], all = quizOf(o.cats);
  const used = all.every(x => o.used.includes(x.answer)) ? [q.answer] : [...o.used, q.answer]; // 다 냈으면 처음부터
  prefs.set({ cur: q, used, hint: 0, shown: false, n: o.n + 1 });
  render();
}
function hint() {
  const o = prefs.get();
  if (o.shown || o.hint >= syllables(o.cur.answer) - 1) return;
  prefs.set({ hint: o.hint + 1 });
  beep(520, 60);
  render();
}
function show() {
  if (prefs.get().shown) return;
  prefs.set({ shown: true });
  render();
}
function score(i, d) {
  const o = prefs.get(), scores = o.scores.map((s, k) => (k === i ? Math.max(0, s + d) : s));
  prefs.set({ scores, shown: d > 0 ? true : o.shown }); // 맞힌 팀에 점수를 주면 정답도 보여 줌
  if (d > 0) { beep(880, 90); setTimeout(() => beep(1320, 140), 90); }
  render();
}

// ---------- 끝 ----------
function endPanel(o) {
  const panel = h('section', 'panel quiz-panel'), top = Math.max(...o.scores), wins = o.scores.map((s, i) => (s === top ? i : -1)).filter(i => i >= 0);
  const list = h('ol', 'quiz-final');
  o.scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).forEach(([s, i]) => {
    const li = h('li', s === top ? 'win' : '');
    li.append(h('span', '', TEAMS[i].join(' ')), h('b', '', `${s}점`));
    list.append(li);
  });
  const btns = h('div', 'play-btns');
  btns.append(button('같은 팀으로 다시', () => { prefs.set({ phase: 'play', scores: o.scores.map(() => 0), n: 0 }); next(); }, 'btn primary'),
    button('갈래·팀 바꾸기', () => { prefs.set({ phase: 'setup' }); render(); }, 'btn'));
  panel.append(h('p', 'quiz-q shown', wins.length > 1 ? '🤝 비겼어요!' : `🏆 ${TEAMS[wins[0]][1]} 우승!`), h('p', 'quiz-top', `${o.n}문제`), list, btns);
  return panel;
}

// 큰 화면에서 진행하는 사람용 단축키
addEventListener('keydown', e => {
  const o = prefs.get();
  if (o.phase !== 'play' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea')) return;
  if (e.key === 'h' || e.key === 'H' || e.key === 'ㅗ') hint();
  else if (e.key === 'Enter') { e.preventDefault(); show(); }
  else if (e.key === 'ArrowRight') next();
  else if (/^[1-4]$/.test(e.key) && +e.key <= o.scores.length) score(+e.key - 1, 1);
});

$('headEnd').append(soundButton(prefs));
render();
