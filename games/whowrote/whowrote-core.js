'use strict';
// 누가 썼을까 계산과 질문 (화면 없음): whowrote.js 가 쓰고 tests/whowrote.test.js 가 Node에서 확인
// 진행하는 사람이 질문을 고르고, 각자 폰으로 몰래 답하면, 큰 화면에 답을 하나씩 띄워 누가 썼는지 맞힘

const MAX_QUESTIONS = 5, MAX_ANSWER = 100, MAX_NAME = 20; // firestore.rules와 같은 수
const PRESET_QUESTIONS = [
  '올해 가장 잘한 소비는?',
  '올해 나를 가장 웃게 한 일은?',
  '내년에 꼭 해 보고 싶은 것은?',
  '올해 새로 생긴 취미나 습관은?',
  '올해 가장 많이 들은 노래는?',
  '올해의 맛집 한 곳은?',
  '산타에게 받고 싶은 선물은?',
  '어린 시절 크리스마스 기억 하나',
  '올해 연구실에서 가장 기억에 남는 순간은?',
  '남들은 모르는 나의 소소한 비밀 하나',
  '나에게 주는 올해의 상 이름은?',
  '올해의 나를 한 단어로 하면?',
];
// 공개 순서: 질문 순서대로, 한 질문 안에서는 섞어서 (답한 순서로 누군지 짐작하지 않게) → 답 id 목록
function revealOrder(answers, nQuestions) {
  const out = [];
  for (let q = 0; q < nQuestions; q++) out.push(...cryptoShuffle(answers.filter(a => a.q === q)).map(a => a.id));
  return out;
}
