// 주문 모으기 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('games/order/order-core.js');

test('메뉴 글 → 줄: 빈 줄·앞뒤 빈칸·겹치는 이름 빼기', () => {
  assert.deepEqual(P.parseMenu(' 아메리카노 \n\n카페라떼\n아메리카노\n  바닐라   라떼 '), ['아메리카노', '카페라떼', '바닐라 라떼']);
  assert.deepEqual(P.parseMenu(''), []);
  assert.equal(P.parseMenu(Array.from({ length: 200 }, (_, i) => `메뉴${i}`).join('\n')).length, P.MENU_MAX);
  assert.equal(P.parseMenu('가'.repeat(100))[0].length, P.NAME_MAX);
});

test('아이스/따뜻한 표시: 여러 꼴을 알아듣고 (아이스/따뜻한)으로 맞추기', () => {
  for (const s of ['아메리카노 (아이스/따뜻한)', '아메리카노 HOT/ICE', '아메리카노(ice/hot)', '아메리카노 [핫/아이스]', '아메리카노 따뜻한·아이스', '아메리카노 아이스 / 핫']) {
    assert.deepEqual(P.readEntry(s), { name: '아메리카노', temps: true }, s);
    assert.deepEqual(P.parseMenu(s), ['아메리카노 (아이스/따뜻한)'], s);
  }
  for (const s of ['아이스티', '아이스 아메리카노', '핫초코', '아이스/핫초코', '자몽에이드']) assert.equal(P.readEntry(s).temps, false, s);
  // 같은 이름이 나눔·안 나눔으로 두 번 나오면 나눔으로 한 번만
  assert.deepEqual(P.parseMenu('카페라떼\n카페라떼 HOT/ICE'), ['카페라떼 (아이스/따뜻한)']);
  // 나누는 메뉴가 있으면 따로 적은 아이스·따뜻한 줄은 빼서 한 칸을 두 번 세지 않음
  assert.deepEqual(P.parseMenu('아이스 아메리카노\n아메리카노 HOT/ICE\n따뜻한 아메리카노\n아이스티'), ['아메리카노 (아이스/따뜻한)', '아이스티']);
});

test('세는 칸: 나누는 메뉴는 아이스·따뜻한 둘', () => {
  assert.deepEqual(P.entryKeys('아메리카노 (아이스/따뜻한)'), [{ key: '아이스 아메리카노', temp: 'ice' }, { key: '따뜻한 아메리카노', temp: 'hot' }]);
  assert.deepEqual(P.entryKeys('자몽에이드'), [{ key: '자몽에이드', temp: '' }]);
  assert.equal(P.entryTotal('아메리카노 (아이스/따뜻한)', { '아이스 아메리카노': 3, '따뜻한 아메리카노': 2, 아메리카노: 9 }), 5);
});

test('읽은 메뉴 붙이기: 있던 메뉴 뒤에, 겹치는 건 한 번만', () => {
  assert.equal(P.addNames('아메리카노\n카페라떼', ['카페라떼', '녹차라떼']), '아메리카노\n카페라떼\n녹차라떼');
  assert.equal(P.addNames('', [{ name: '아메리카노', temps: true }]), '아메리카노 (아이스/따뜻한)');
  assert.equal(P.addNames('아메리카노', [{ name: '아메리카노', temps: true }]), '아메리카노 (아이스/따뜻한)');
});

test('바를 정: 다섯 획씩 묶기', () => {
  assert.deepEqual(P.tallyGroups(0), []);
  assert.deepEqual(P.tallyGroups(1), [1]);
  assert.deepEqual(P.tallyGroups(5), [5]);
  assert.deepEqual(P.tallyGroups(12), [5, 5, 2]);
  assert.deepEqual(P.tallyGroups(-3), []);
  for (let n = 0; n <= 60; n++) assert.equal(P.tallyGroups(n).reduce((s, g) => s + g, 0), n);
});

test('메뉴를 고치면: 남은 칸은 개수 그대로, 빠진 칸은 dropped', () => {
  const r = P.keepCounts({ 아메리카노: 3, 카페라떼: 0, 녹차라떼: 2 }, ['아메리카노', '카페라떼']);
  assert.deepEqual(r.counts, { 아메리카노: 3 });
  assert.deepEqual(r.dropped, [['녹차라떼', 2]]);
  // 나누던 메뉴를 안 나누게 바꾸면 아이스·따뜻한 개수는 빠짐
  const s = P.keepCounts({ '아이스 아메리카노': 4, '따뜻한 아메리카노': 1 }, ['아메리카노']);
  assert.deepEqual(s.counts, {});
  assert.deepEqual(s.dropped, [['아이스 아메리카노', 4], ['따뜻한 아메리카노', 1]]);
  assert.deepEqual(P.keepCounts({ '아이스 아메리카노': 4 }, ['아메리카노 (아이스/따뜻한)']).counts, { '아이스 아메리카노': 4 });
});

test('주문 글: 메뉴 순서대로, 아이스 먼저, 0개는 빼고, 모두 몇 잔', () => {
  const menu = ['아메리카노 (아이스/따뜻한)', '카페라떼', '녹차라떼'];
  assert.equal(P.orderText(menu, { 녹차라떼: 1, '따뜻한 아메리카노': 2, '아이스 아메리카노': 5, 카페라떼: 0 }),
    '☕ 주문 (모두 8잔)\n아이스 아메리카노 5\n따뜻한 아메리카노 2\n녹차라떼 1');
  assert.equal(P.totalOf({}), 0);
});

test('사진 줄이기: 긴 쪽을 맞추고 비율 그대로, 작은 사진은 그대로', () => {
  assert.deepEqual(P.fitSize(4000, 3000, 2000), [2000, 1500]);
  assert.deepEqual(P.fitSize(3000, 4000, 2000), [1500, 2000]);
  assert.deepEqual(P.fitSize(800, 600, 2000), [800, 600]);
});

test('Claude 답 읽기: items의 name·hot_ice만, 모양이 다르면 빼거나 빈 목록', () => {
  assert.deepEqual(P.parseMenuReply(JSON.stringify({ items: [
    { name: '아메리카노', hot_ice: true }, { name: ' 자몽에이드 ', hot_ice: false }, { name: '아메리카노', hot_ice: false },
    { name: '카페라떼 HOT/ICE', hot_ice: false }, { hot_ice: true }, '바닐라라떼',
  ] })), ['아메리카노 (아이스/따뜻한)', '자몽에이드', '카페라떼 (아이스/따뜻한)']);
  assert.deepEqual(P.parseMenuReply('{"items":"아메리카노"}'), []);
  assert.deepEqual(P.parseMenuReply('메뉴판이 아니에요'), []);
  assert.deepEqual(P.parseMenuReply(''), []);
});
