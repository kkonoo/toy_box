// 사다리 계산 확인: node --test (저장소 맨 위에서). 살림노트 tests/play.test.js 에서 가져옴 (인원만 12명까지)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/ladder/ladder-core.js');

test('사다리: 무작위 1000개 모두 참가자와 결과가 1:1 (중복·누락 없음)', () => {
  for (let k = 0; k < 1000; k++) {
    const n = 2 + (k % 11); // 2~12명
    const lad = P.makeLadder(n), map = P.ladderMap(lad);
    assert.equal(new Set(map).size, n, `중복 결과: ${map}`);
    assert.ok(map.every(e => e >= 0 && e < n));
    for (const row of lad.rungs) row.forEach(c => assert.ok(!row.includes(c + 1), '한 줄에 가로줄이 붙어 있음'));
    for (let c = 0; c < n - 1; c++) assert.ok(lad.rungs.some(row => row.includes(c)), `${c}–${c + 1} 사이 가로줄 없음`);
  }
});

test('사다리: 그리는 길이 도착한 세로줄에서 끝남', () => {
  for (const n of [5, 12]) {
    const lad = P.makeLadder(n);
    for (let i = 0; i < n; i++) {
      const { end, path } = P.traceLadder(lad, i);
      assert.deepEqual(path[0], [i, -1]);
      assert.deepEqual(path[path.length - 1], [end, lad.rows]);
      for (let j = 1; j < path.length; j++) { // 가로(같은 줄) 아니면 세로(같은 세로줄)로만 움직임
        const [a, b] = [path[j - 1], path[j]];
        assert.ok(a[0] === b[0] || (a[1] === b[1] && Math.abs(a[0] - b[0]) === 1));
      }
    }
  }
});
