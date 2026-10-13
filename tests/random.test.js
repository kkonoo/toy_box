// 난수 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./load.js')('js/random.js');

test('randInt: 범위 안, 0 이상', () => {
  for (const max of [1, 2, 3, 7, 1000]) {
    for (let k = 0; k < 2000; k++) {
      const v = R.randInt(max);
      assert.ok(Number.isInteger(v) && v >= 0 && v < max);
    }
  }
});

test('cryptoShuffle: 같은 것들, 원래 배열은 그대로', () => {
  const a = [1, 2, 3, 4, 5, 6];
  const b = R.cryptoShuffle(a);
  assert.deepEqual(a, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...b].sort(), a);
});
