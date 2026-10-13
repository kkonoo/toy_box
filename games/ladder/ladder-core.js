'use strict';
// 사다리 계산 (화면 없음): ladder.js 가 쓰고, tests/ladder.test.js 가 Node에서 확인
// 살림노트(everyday_notes) js/play-core.js 에서 가져옴

// rungs[r] = 위에서 r번째 줄의 가로줄들 (가로줄이 잇는 두 세로줄 중 왼쪽 번호). 한 줄에 가로줄끼리 붙지 않게
// 이웃한 세로줄 사이마다 가로줄이 하나는 있게 (없으면 다시 만듦 → 아무도 곧장 내려가기만 하지 않게)
function makeLadder(n, rows = Math.max(8, n + 6)) {
  for (;;) {
    const rungs = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < n - 1; c++) if (!row.includes(c - 1) && randInt(2)) row.push(c);
      rungs.push(row);
    }
    if ([...Array(n - 1).keys()].every(c => rungs.some(row => row.includes(c)))) return { n, rows, rungs };
  }
}
// start번 세로줄에서 내려간 길: 꺾이는 점 [세로줄, 줄] 목록 (줄 −1 = 맨 위, rows = 맨 아래)과 도착한 세로줄
function traceLadder({ rows, rungs }, start) {
  let c = start;
  const path = [[c, -1]];
  rungs.forEach((row, r) => {
    const to = row.includes(c) ? c + 1 : row.includes(c - 1) ? c - 1 : c;
    if (to !== c) { path.push([c, r], [to, r]); c = to; }
  });
  path.push([c, rows]);
  return { end: c, path };
}
// 참가자 i → 결과 번호
const ladderMap = lad => Array.from({ length: lad.n }, (_, i) => traceLadder(lad, i).end);
