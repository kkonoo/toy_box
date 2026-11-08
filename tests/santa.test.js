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

test('링크: 위시리스트 id도 담고, 위시리스트 전 링크(w·rw 없음)도 그대로 열림', () => {
  const card = { d: 'K3F9', g: '김연구원', r: '박교수님', w: P.wishId(), rw: P.wishId() };
  assert.deepEqual({ ...P.decodeCard(P.encodeCard(card)) }, card);
  assert.deepEqual({ ...P.decodeCard(P.encodeCard({ d: 'K3F9', g: 'a', r: 'b' })) }, { d: 'K3F9', g: 'a', r: 'b' });
});

test('링크: 잘못된 것은 null', () => {
  for (const bad of ['', 'abc', '!!!', P.encodeCard({ d: 'X' }), btoa('{"g":"a","r":"b","d":"c"}'),
    P.encodeCard({ d: 'X', g: 'a', r: 'b', w: 'short' }), P.encodeCard({ d: 'X', g: 'a', r: 'b', rw: 'AAAA/AAAAAAAAAAA' })]) assert.equal(P.decodeCard(bad), null);
});

test('위시리스트 id: 16글자, 헷갈리는 글자 없음, 겹치지 않음', () => {
  const seen = new Set();
  for (let k = 0; k < 2000; k++) { const id = P.wishId(); assert.match(id, /^[A-HJ-NP-Z2-9]{16}$/); seen.add(id); }
  assert.equal(seen.size, 2000);
});

test('위시 참고 링크: 주소만 꺼내고, 앞이 없으면 https:// 붙임', () => {
  assert.equal(P.wishLink(''), '');
  assert.equal(P.wishLink('  '), '');
  assert.equal(P.wishLink('https://www.coupang.com/vp/products/123?itemId=4'), 'https://www.coupang.com/vp/products/123?itemId=4');
  assert.equal(P.wishLink('쿠팡을 추천합니다! 겨울 장갑\nhttps://link.coupang.com/a/bXyZ12'), 'https://link.coupang.com/a/bXyZ12');
  assert.equal(P.wishLink('naver.me/abc'), 'https://naver.me/abc');
  assert.equal(P.wishLink('HTTP://Example.com/Path'), 'http://example.com/Path');
  assert.equal(P.wishLink('https://smartstore.naver.com/상품'), 'https://smartstore.naver.com/%EC%83%81%ED%92%88');
  for (const bad of ['겨울 장갑', 'javascript:alert(1)', 'ftp://a.com/x', 'https://localhost/x', `https://a.com/${'x'.repeat(1000)}`]) assert.equal(P.wishLink(bad), null, bad);
});

test('이름: 쉼표·줄바꿈, 겹치는 이름 찾기', () => {
  assert.deepEqual([...P.parseNames(' 민지, 서준\n\n하은 ,')], ['민지', '서준', '하은']);
  assert.deepEqual([...P.dupNames(['민지', '서준', '민 지', 'Ann', 'ann'])], ['민 지', 'ann']);
});

test('추첨 번호: 4글자, 헷갈리는 글자 없음', () => {
  for (let k = 0; k < 500; k++) assert.match(P.drawCode(), /^[A-HJ-NP-Z2-9]{4}$/);
});

// 선물 주인 맞히기 예: 민지→서준, 서준→민지, 하은→도윤, 도윤→하은 (서로 뽑은 쌍 둘)
const SANTA = { 서준: '민지', 민지: '서준', 도윤: '하은', 하은: '도윤' }; // 받는 사람: 준 사람
const ORDER = ['하은', '민지', '도윤', '서준'];

test('맞히기: 매칭 카드에서 받는 사람 → 산타', () => {
  assert.deepEqual({ ...P.santaOfDraw([{ g: '민지', r: '서준' }, { g: '서준', r: '민지' }]) }, { 서준: '민지', 민지: '서준' });
});

test('맞히기: 다음 차례는 아직 못 맞힌 사람, 한 바퀴 돌고, 다 맞히면 -1', () => {
  assert.equal(P.nextGuesser(ORDER, 0, {}, SANTA), 1);
  assert.equal(P.nextGuesser(ORDER, 3, {}, SANTA), 0);
  const tries = { 민지: ['서준'], 도윤: ['하은'] }; // 민지·도윤 맞힘
  assert.equal(P.nextGuesser(ORDER, 0, tries, SANTA), 3);
  assert.equal(P.nextGuesser(ORDER, 3, tries, SANTA), 0);
  assert.equal(P.nextGuesser(ORDER, 0, { ...tries, 하은: ['민지', '도윤'], 서준: ['민지'] }, SANTA), -1);
});

test('맞히기: 나·이미 찍은 이름·밝혀진 산타는 못 찍음', () => {
  assert.deepEqual([...P.guessChoices('하은', ORDER, {}, SANTA)], ['민지', '도윤', '서준']);
  assert.deepEqual([...P.guessChoices('하은', ORDER, { 하은: ['민지'] }, SANTA)], ['도윤', '서준']);
  // 민지가 서준을 맞힘 → 서준은 민지의 산타로 밝혀짐 → 하은은 서준을 못 찍음
  assert.deepEqual([...P.guessChoices('하은', ORDER, { 민지: ['도윤', '서준'] }, SANTA)], ['민지', '도윤']);
  // 틀리게 찍은 이름(도윤)은 밝혀진 게 아님
  assert.deepEqual([...P.guessChoices('서준', ORDER, { 민지: ['도윤'] }, SANTA)], ['하은', '민지', '도윤']);
});

test('맞히기: 기록 표', () => {
  const tries = { 하은: ['민지', '서준', '도윤'], 민지: ['서준'], 도윤: ['민지', '하은'], 서준: ['하은', '민지'] };
  assert.deepEqual(P.guessTable(ORDER, tries, SANTA).map(r => `${r.name}${r.n}${r.ok ? 'O' : 'X'}`), ['민지1O', '도윤2O', '서준2O', '하은3O']);
  // 중간: 못 맞힌 사람은 아래, 많이 찍은 순
  const mid = { 하은: ['민지'], 민지: ['서준'], 도윤: ['민지', '서준'] };
  assert.deepEqual(P.guessTable(ORDER, mid, SANTA).map(r => `${r.name}${r.n}${r.ok ? 'O' : 'X'}`), ['민지1O', '도윤2X', '하은1X', '서준0X']);
});
