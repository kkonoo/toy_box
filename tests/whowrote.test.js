// 누가 썼을까 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/whowrote/whowrote-core.js');

test('질문: 겹치지 않고, 짧게', () => {
  assert.equal(new Set(P.PRESET_QUESTIONS).size, P.PRESET_QUESTIONS.length);
  assert.ok(P.PRESET_QUESTIONS.every(q => q.length <= 40));
});

test('공개 순서: 질문 순서대로, 질문 안에서는 섞음, 없는 질문 번호는 빠짐', () => {
  const answers = [{ id: 'a', q: 1 }, { id: 'b', q: 0 }, { id: 'c', q: 1 }, { id: 'd', q: 0 }, { id: 'e', q: 9 }];
  const seen = new Set();
  for (let k = 0; k < 200; k++) {
    const o = P.revealOrder(answers, 2);
    assert.deepEqual(o.slice(0, 2).sort(), ['b', 'd']);
    assert.deepEqual(o.slice(2).sort(), ['a', 'c']);
    seen.add(o.join(''));
  }
  assert.equal(seen.size, 4, '질문 안에서 섞이지 않음');
});
