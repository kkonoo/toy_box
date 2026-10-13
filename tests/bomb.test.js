// 폭탄 돌리기 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/bomb/bomb-core.js');

test('폭탄: 터지는 때가 고른 범위 안', () => {
  for (const f of Object.values(P.FUSES)) {
    for (let k = 0; k < 5000; k++) {
      const ms = P.fuseMs(f);
      assert.ok(Number.isInteger(ms) && ms >= f.min * 1000 && ms <= f.max * 1000, `${ms}ms`);
    }
  }
});

test('폭탄: 범위 안에서 고르게 (앞·중간·뒤가 비슷하게 나옴)', () => {
  const f = P.FUSES.normal, span = (f.max - f.min) * 1000, count = [0, 0, 0];
  for (let k = 0; k < 9000; k++) count[Math.min(2, Math.floor((P.fuseMs(f) - f.min * 1000) / span * 3))]++;
  for (const c of count) assert.ok(Math.abs(c - 3000) < 3000 * 0.1, `치우침: ${count}`);
});
