// 주문 모으기 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('games/order/order-core.js');

test('메뉴 글 → 이름: 빈 줄·앞뒤 빈칸·겹치는 이름 빼기', () => {
  assert.deepEqual(P.parseMenu(' 아메리카노 \n\n카페라떼\n아메리카노\n  바닐라   라떼 '), ['아메리카노', '카페라떼', '바닐라 라떼']);
  assert.deepEqual(P.parseMenu(''), []);
  assert.equal(P.parseMenu(Array.from({ length: 200 }, (_, i) => `메뉴${i}`).join('\n')).length, P.MENU_MAX);
  assert.equal(P.parseMenu('가'.repeat(100))[0].length, P.NAME_MAX);
});

test('읽은 이름 붙이기: 있던 메뉴 뒤에, 겹치는 건 한 번만', () => {
  assert.equal(P.addNames('아메리카노\n카페라떼', ['카페라떼', '녹차라떼']), '아메리카노\n카페라떼\n녹차라떼');
  assert.equal(P.addNames('', ['아메리카노']), '아메리카노');
});

test('바를 정: 다섯 획씩 묶기', () => {
  assert.deepEqual(P.tallyGroups(0), []);
  assert.deepEqual(P.tallyGroups(1), [1]);
  assert.deepEqual(P.tallyGroups(5), [5]);
  assert.deepEqual(P.tallyGroups(12), [5, 5, 2]);
  assert.deepEqual(P.tallyGroups(-3), []);
  for (let n = 0; n <= 60; n++) assert.equal(P.tallyGroups(n).reduce((s, g) => s + g, 0), n);
});

test('메뉴를 고치면: 남은 메뉴는 개수 그대로, 빠진 메뉴는 dropped', () => {
  const r = P.keepCounts({ 아메리카노: 3, 카페라떼: 0, 녹차라떼: 2 }, ['아메리카노', '카페라떼']);
  assert.deepEqual(r.counts, { 아메리카노: 3 });
  assert.deepEqual(r.dropped, [['녹차라떼', 2]]);
});

test('주문 글: 메뉴 순서대로, 0개는 빼고, 모두 몇 잔', () => {
  const menu = ['아메리카노', '카페라떼', '녹차라떼'];
  assert.equal(P.orderText(menu, { 녹차라떼: 1, 아메리카노: 5, 카페라떼: 0 }), '☕ 주문 (모두 6잔)\n아메리카노 5\n녹차라떼 1');
  assert.equal(P.totalOf({}), 0);
});

test('사진 줄이기: 긴 쪽을 맞추고 비율 그대로, 작은 사진은 그대로', () => {
  assert.deepEqual(P.fitSize(4000, 3000, 2000), [2000, 1500]);
  assert.deepEqual(P.fitSize(3000, 4000, 2000), [1500, 2000]);
  assert.deepEqual(P.fitSize(800, 600, 2000), [800, 600]);
});

test('Claude 답 읽기: items만, 모양이 다르면 빈 목록', () => {
  assert.deepEqual(P.parseMenuReply('{"items":["아메리카노"," 카페라떼 ","아메리카노",3]}'), ['아메리카노', '카페라떼']);
  assert.deepEqual(P.parseMenuReply('{"items":"아메리카노"}'), []);
  assert.deepEqual(P.parseMenuReply('메뉴판이 아니에요'), []);
  assert.deepEqual(P.parseMenuReply(''), []);
});
