// 포트럭 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/potluck/potluck-core.js');

test('추천 칸: 합은 인원 수, 8명이면 메인·디저트 2칸씩', () => {
  for (let n = 1; n <= 40; n++) assert.equal(P.recommendSlots(n).reduce((a, b) => a + b, 0), n, `${n}명`);
  assert.deepEqual([...P.recommendSlots(8)], [1, 2, 1, 1, 2, 1]);
  assert.deepEqual([...P.recommendSlots(5)], [1, 1, 1, 0, 1, 1]);
  assert.deepEqual([...P.recommendSlots(10)], [2, 3, 1, 1, 2, 1]);
});

test('예시 메뉴: 카테고리마다 5개 넘게, 겹치지 않고, 쉼표 없이 (저장할 때 쉼표로 이음)', () => {
  for (const c of P.POT_CATS) {
    assert.ok(c.ex.length >= 5, c.name);
    assert.equal(new Set(c.ex).size, c.ex.length, c.name);
    assert.ok(c.ex.every(x => !x.includes(',')), c.name);
    assert.deepEqual([...P.exList(c.ex.join(', '))], c.ex, '저장했다 다시 읽어도 그대로');
  }
  assert.deepEqual([...P.exList('잡채, 라자냐')], ['잡채', '라자냐']); // 예전 포트럭
  assert.deepEqual([...P.exList(undefined)], []);
});

const CATS = [{ name: 'A', slots: 2 }, { name: 'B', slots: 1 }, { name: 'C', slots: 0 }];
const E = (name, cat, at = 0) => ({ name, cat, dish: '', at });

test('남은 칸: 카테고리마다 칸 - 신청', () => {
  assert.deepEqual([...P.openSlots(CATS, [E('민지', 0), E('서준', 1), E('하은', 1)])], [1, 0, 0]);
});

test('랜덤 배정: 신청한 사람·겹친 이름은 빼고 빈 칸부터, 칸이 모자라면 칸 있는 곳 아무 데나', () => {
  for (let k = 0; k < 200; k++) {
    const got = P.fillRandom(CATS, [E('민지', 0)], ['민 지', '서준', '하은', '서준', 'Ann', 'ann']);
    assert.deepEqual(got.map(x => x.name).sort(), ['Ann', '서준', '하은'].sort());
    assert.equal(got.filter(x => x.cat === 2).length, 0, '칸 0인 카테고리엔 안 넣음');
    // 빈 칸(A 1, B 1)은 꼭 채움
    assert.ok(got.some(x => x.cat === 0) && got.some(x => x.cat === 1));
  }
  assert.deepEqual(P.fillRandom(CATS, [], []), []);
});

test('목록 글: 카테고리마다 신청·빈 칸, 칸도 신청도 없는 카테고리는 빼기', () => {
  const text = P.potluckText('🎄 포트럭', CATS, [E('서준', 1, 2), { ...E('민지', 0, 1), dish: '잡채' }, { ...E('하은', 0, 3), host: true }]);
  assert.equal(text, '🎄 포트럭\n\nA 2/2\n- 민지: 잡채\n- 하은: 메뉴 미정 (랜덤)\n\nB 1/1\n- 서준: 메뉴 미정');
  assert.equal(P.potluckText('t', [{ name: 'A', slots: 1 }], []), 't\n\nA 0/1\n- (빈 칸)');
});
