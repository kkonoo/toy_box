// 시크릿 산타 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/santa/santa-core.js');

test('매칭: 모두 한 번씩 주고받고, 자기 자신은 안 뽑힘', () => {
  for (let n = 3; n <= 30; n++) {
    for (let k = 0; k < 300; k++) {
      const to = P.matchSanta(n);
      assert.equal(new Set(to).size, n);
      assert.ok(to.every((t, i) => t !== i && t >= 0 && t < n), `자기 자신: ${to}`);
    }
  }
});

test('매칭: 4명이면 가능한 9가지가 고르게, 서로 뽑는 쌍도 나옴', () => {
  const count = new Map();
  for (let k = 0; k < 9000; k++) { const key = P.matchSanta(4).join(''); count.set(key, (count.get(key) || 0) + 1); }
  assert.equal(count.size, 9);
  for (const c of count.values()) assert.ok(Math.abs(c - 1000) < 1000 * 0.15, `치우침: ${[...count.values()]}`);
  assert.ok(count.has('1032'), 'A↔B, C↔D 쌍이 안 나옴');
});

test('링크: 이름을 그대로 담지 않고, 풀면 그대로 돌아옴', () => {
  for (const card of [{ d: 'K3F9', g: '김연구원', r: '박교수님' }, { d: 'AB2C', g: 'Mina 🎄', r: '이 박사' }]) {
    const code = P.encodeCard(card);
    assert.match(code, /^[A-Za-z0-9_-]+$/);
    assert.ok(!code.includes(card.g) && !code.includes(card.r));
    assert.deepEqual({ ...P.decodeCard(code) }, card);
  }
});

test('링크: 잘못된 것은 null', () => {
  for (const bad of ['', 'abc', '!!!', P.encodeCard({ d: 'X' }), btoa('{"g":"a","r":"b","d":"c"}')]) assert.equal(P.decodeCard(bad), null);
});

test('이름: 쉼표·줄바꿈, 겹치는 이름 찾기', () => {
  assert.deepEqual([...P.parseNames(' 민지, 서준\n\n하은 ,')], ['민지', '서준', '하은']);
  assert.deepEqual([...P.dupNames(['민지', '서준', '민 지', 'Ann', 'ann'])], ['민 지', 'ann']);
});

test('추첨 번호: 4글자, 헷갈리는 글자 없음', () => {
  for (let k = 0; k < 500; k++) assert.match(P.drawCode(), /^[A-HJ-NP-Z2-9]{4}$/);
});
