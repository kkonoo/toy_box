// 제비뽑기 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/lots/lots-core.js');

test('제비뽑기: n장 중 정확히 k장 당첨', () => {
  for (let n = 2; n <= 30; n++) {
    for (let k = 1; k < n; k++) assert.equal(P.drawLots(n, k).filter(Boolean).length, k);
  }
});

test('제비뽑기: 자리마다 고르게 당첨', () => {
  const n = 6, count = Array(n).fill(0);
  for (let t = 0; t < 6000; t++) P.drawLots(n, 1).forEach((w, i) => { if (w) count[i]++; });
  for (const c of count) assert.ok(Math.abs(c - 1000) < 1000 * 0.15, `치우침: ${count}`);
});
