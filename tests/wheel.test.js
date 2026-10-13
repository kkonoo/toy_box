// 룰렛 계산 확인: node --test (저장소 맨 위에서). 살림노트 tests/play.test.js 에서 가져옴
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/wheel/wheel-core.js');

test('룰렛: 1만 번 — 멈춘 칸 = 발표 결과, 칸마다 고르게', () => {
  const n = 8, count = Array(n).fill(0);
  let rot = 0;
  for (let k = 0; k < 10000; k++) {
    const { index, rotation } = P.spinWheel(n, rot);
    assert.equal(P.sliceAt(rotation, n), index);
    assert.ok(rotation - rot >= 5 * 360 && rotation - rot < 6 * 360);
    count[index]++;
    rot = rotation;
  }
  for (const c of count) assert.ok(Math.abs(c - 1250) < 1250 * 0.15, `치우침: ${count}`);
});

test('룰렛: 칸 수가 달라도 멈춘 칸 = 발표 결과', () => {
  for (let n = 2; n <= 24; n++) {
    for (let k = 0; k < 300; k++) {
      const from = (k * 137.3) % 5000;
      const { index, rotation } = P.spinWheel(n, from);
      assert.equal(P.sliceAt(rotation, n), index);
    }
  }
});
