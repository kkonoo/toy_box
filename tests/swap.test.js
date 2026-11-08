// 선물 뺏기 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/swap/swap-core.js');

const fixed = (names, limit = 3) => ({ ...P.newSwap(names, limit), order: names, actor: names[0] }); // 순서를 정해 두고 확인

test('순서: 모두 한 번씩, 첫 사람이 먼저', () => {
  const g = P.newSwap(['가', '나', '다', '라'], 3);
  assert.deepEqual([...g.order].sort(), ['가', '나', '다', '라']);
  assert.equal(g.actor, g.order[0]);
  assert.equal(P.pileLeft(g), 4);
});

test('열기만 하면 순서대로 하나씩 들고 끝', () => {
  let g = fixed(['가', '나', '다']);
  for (const [who, label] of [['가', '양말'], ['나', '향초'], ['다', '머그']]) { assert.equal(g.actor, who); g = P.openGift(g, label); }
  assert.equal(g.actor, null);
  assert.equal(P.pileLeft(g), 0);
  assert.deepEqual(g.gifts.map(x => `${x.holder}:${x.label}`), ['가:양말', '나:향초', '다:머그']);
});

test('뺏기: 뺏긴 사람이 바로 차례, 방금 뺏긴 건 되뺏기 안 됨, 열면 다음 순서로', () => {
  let g = P.openGift(fixed(['가', '나', '다']), '양말'); // 가: 양말, 나 차례
  g = P.stealGift(g, 0);                                   // 나가 양말 뺏음 → 가 차례
  assert.equal(g.actor, '가');
  assert.equal(g.gifts[0].holder, '나');
  assert.equal(P.stealBlock(g, 0), '방금 뺏긴 선물');
  g = P.openGift(g, '향초');                               // 가가 새로 엶 → 다음 순서(다)
  assert.equal(g.actor, '다');
  assert.equal(P.stealBlock(g, 0), '');
  assert.equal(P.holderOf(g, '가'), 1);
  g = P.stealGift(g, 1);                                   // 다가 향초 뺏음 → 가 차례
  g = P.stealGift(g, 0);                                   // 가가 양말 뺏음 → 나 차례
  assert.equal(g.actor, '나');
  g = P.openGift(g, '머그');                               // 남은 하나 → 끝
  assert.equal(g.actor, null);
  assert.deepEqual(g.gifts.map(x => `${x.holder}:${x.label}:${x.steals}`), ['가:양말:2', '다:향초:1', '나:머그:0']);
});

test('뺏기 제한: limit번 뺏기면 잠김, 0이면 제한 없음', () => {
  let g = P.openGift(fixed(['가', '나', '다', '라'], 2), '양말');
  g = P.stealGift(g, 0);                                   // 나 ← 가 (1번)
  g = P.openGift(g, '향초');                               // 가 엶 → 다 차례
  g = P.stealGift(g, 0);                                   // 다 ← 나 (2번)
  assert.equal(P.stealBlock(g, 0), '방금 뺏긴 선물');
  g = P.openGift(g, '머그');                               // 나 엶 → 라 차례
  assert.equal(P.stealBlock(g, 0), '더 못 뺏어요');
  const free = { ...g, limit: 0 };
  assert.equal(P.stealBlock(free, 0), '');
});

test('언제나: 지금 할 사람은 선물이 없고, 남은 선물이 있음', () => {
  for (let k = 0; k < 300; k++) {
    let g = P.newSwap(['가', '나', '다', '라', '마', '바'], k % 4);
    while (g.actor != null) {
      assert.equal(P.holderOf(g, g.actor), -1);
      assert.ok(P.pileLeft(g) > 0);
      const can = g.gifts.map((_, i) => i).filter(i => !P.stealBlock(g, i));
      g = can.length && Math.random() < 0.6 ? P.stealGift(g, can[Math.floor(Math.random() * can.length)]) : P.openGift(g, 'x');
    }
    assert.equal(new Set(g.gifts.map(x => x.holder)).size, 6);
  }
});
