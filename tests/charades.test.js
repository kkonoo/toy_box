// 몸으로 말해요 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/charades/charades-core.js');

test('낱말: 갈래마다 20개 넘게, 겹치는 낱말 없음', () => {
  for (const [key, label, words] of P.CATS) {
    assert.ok(words.length >= 20, `${label} ${words.length}개`);
    assert.equal(new Set(words).size, words.length, `${key} 안에서 겹침`);
  }
  const all = P.CATS.flatMap(c => c[2]);
  assert.equal(new Set(all).size, all.length, '갈래끼리 겹침');
});

test('섞기: 고른 갈래에서만, 나온 낱말은 빼고, 다 나오면 다시 처음부터', () => {
  const xmas = new Set(P.wordsOf(['xmas']));
  const d = P.charadesDeck(['xmas'], new Set());
  assert.equal(d.length, xmas.size);
  assert.ok(d.every(w => xmas.has(w)));
  const used = new Set(d.slice(0, 10));
  const d2 = P.charadesDeck(['xmas'], used);
  assert.equal(d2.length, xmas.size - 10);
  assert.ok(d2.every(w => !used.has(w)));
  assert.equal(P.charadesDeck(['xmas'], new Set(xmas)).length, xmas.size);
  assert.equal(P.charadesDeck(['xmas', 'lab'], new Set()).length, xmas.size + P.wordsOf(['lab']).length);
});
