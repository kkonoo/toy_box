// 초성 퀴즈 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('js/random.js', 'games/chosung/chosung-core.js');

test('초성: 한글만 첫소리로, 띄어쓰기·숫자는 그대로', () => {
  assert.equal(P.chosung('루돌프 사슴코'), 'ㄹㄷㅍ ㅅㅅㅋ');
  assert.equal(P.chosung('34번가의 기적'), '34ㅂㄱㅇ ㄱㅈ');
  assert.equal(P.chosung('까치 빵 쌀 짜장 떡'), 'ㄲㅊ ㅃ ㅆ ㅉㅈ ㄸ');
  assert.equal(P.chosung('가힣'), 'ㄱㅎ');
});

test('힌트: 앞에서부터 한글 k글자만 풀기', () => {
  assert.equal(P.hintText('루돌프 사슴코', 0), 'ㄹㄷㅍ ㅅㅅㅋ');
  assert.equal(P.hintText('루돌프 사슴코', 2), '루돌ㅍ ㅅㅅㅋ');
  assert.equal(P.hintText('루돌프 사슴코', 4), '루돌프 사ㅅㅋ');
  assert.equal(P.hintText('루돌프 사슴코', 9), '루돌프 사슴코');
  assert.equal(P.hintText('34번가의 기적', 1), '34번ㄱㅇ ㄱㅈ');
  assert.equal(P.syllables('34번가의 기적'), 5);
});

test('문제: 갈래마다 15개 넘게, 겹치지 않고, 한글 2글자 이상', () => {
  const all = [];
  for (const [key, label, list] of P.QUIZ) {
    assert.ok(list.length >= 15, `${label} ${list.length}개`);
    for (const a of list) { assert.ok(P.syllables(a) >= 2, a); all.push(a); }
  }
  assert.equal(new Set(all).size, all.length, all.filter((a, i) => all.indexOf(a) !== i).join(','));
});

test('문제 고르기: 고른 갈래만, 낸 건 빼고, 다 내면 다시', () => {
  const food = P.quizOf(['food']);
  assert.ok(food.every(q => q.key === 'food'));
  const d = P.quizDeck(['food'], []);
  assert.equal(d.length, food.length);
  const used = d.slice(0, 5).map(q => q.answer);
  assert.ok(P.quizDeck(['food'], used).every(q => !used.includes(q.answer)));
  assert.equal(P.quizDeck(['food'], food.map(q => q.answer)).length, food.length);
});
