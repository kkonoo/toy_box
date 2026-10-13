// 타로 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/tarot/tarot-cards.js', 'games/tarot/tarot-core.js');

test('카드 78장: 메이저 22 + 수트마다 14, 뜻이 다 있음', () => {
  const ids = P.TAROT_CARDS.map(c => c.id);
  assert.equal(new Set(ids).size, 78);
  assert.equal(ids.filter(id => id[0] === 'm').length, 22);
  for (const s of 'wcsp') assert.equal(ids.filter(id => id[0] === s).length, 14);
  for (const c of P.TAROT_CARDS) for (const k of ['name', 'en', 'kw', 'short', 'up', 'rev']) assert.ok(c[k].trim(), `${c.id} ${k}`);
});

test('카드 앞면: 번호·이모지', () => {
  assert.equal(P.cardFace('m00').mark, '0');
  assert.equal(P.cardFace('m21').mark, 'XXI');
  assert.equal(P.cardFace('m18').emoji, '🌙');
  assert.equal(P.cardFace('w01').mark, 'A');
  assert.equal(P.cardFace('c10').mark, '10');
  assert.equal(P.cardFace('s12').mark, 'N');
  assert.equal(P.cardFace('p14').emoji, '🪙');
  for (const c of P.TAROT_CARDS) assert.ok(P.cardFace(c.id).mark && P.cardFace(c.id).emoji, c.id);
});

test('펼치기: 겹치지 않는 카드, 역방향은 켰을 때만 반반', () => {
  for (const spread of Object.keys(P.SPREADS)) {
    const lay = P.layCount(spread);
    assert.ok(lay >= P.SPREADS[spread].pos.length);
    const deck = P.dealDeck(lay, false);
    assert.equal(deck.length, lay);
    assert.equal(new Set(deck.map(c => c.id)).size, lay);
    assert.ok(deck.every(c => c.reversed === false));
  }
  let rev = 0;
  for (let k = 0; k < 400; k++) rev += P.dealDeck(15, true).filter(c => c.reversed).length;
  assert.ok(Math.abs(rev / 6000 - 0.5) < 0.05, `역방향 비율 ${rev / 6000}`);
});

test('펼치기: 78장 모두 나올 수 있고 고르게', () => {
  const count = new Map();
  for (let k = 0; k < 7800; k++) for (const c of P.dealDeck(10, false)) count.set(c.id, (count.get(c.id) || 0) + 1);
  assert.equal(count.size, 78);
  for (const n of count.values()) assert.ok(Math.abs(n - 1000) < 1000 * 0.2, `치우침 ${n}`);
});

test('읽기: 자리 문장과 Claude에게 보낼 글', () => {
  assert.equal(P.cardReading('과거', { id: 'm00', reversed: true }), `과거 자리에 ‘바보’ 카드가 거꾸로 나왔어요. ${P.TAROT_CARDS[0].rev}`);
  const text = P.readingPrompt('three', [{ id: 'm00', reversed: false }, { id: 'p04', reversed: true }, { id: 'c02', reversed: false }], { kind: 'love', question: '다시 연락이 올까?' }, '2026-12-24');
  assert.match(text, /스프레드: 쓰리 카드/);
  assert.match(text, /1\. 과거 — 바보 \(The Fool\) 정방향/);
  assert.match(text, /2\. 현재 — 펜타클 4 \(Four of Pentacles\) 역방향/);
  assert.match(text, /\[질문\]\n💕 연애 — 다시 연락이 올까\?/);
  assert.match(P.readingPrompt('one', [{ id: 'm01', reversed: false }], {}, '2026-12-24'), /\[질문\]\n없음/);
  assert.ok(!/공부/.test(P.READER_SYSTEM), '읽는 법에 공부용 말이 없음');
});
