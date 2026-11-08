'use strict';
// 초성 퀴즈 계산과 문제 (화면 없음): chosung.js 가 쓰고 tests/chosung.test.js 가 Node에서 확인

// 한글 글자 → 첫소리(ㄱ·ㄴ…). 한글이 아닌 것(띄어쓰기·숫자·영어)은 그대로
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const isSyllable = c => c >= '가' && c <= '힣';
const choOf = c => (isSyllable(c) ? CHO[Math.floor((c.charCodeAt(0) - 0xAC00) / 588)] : c);
const chosung = text => [...text].map(choOf).join('');
const syllables = text => [...text].filter(isSyllable).length;
// 힌트: 앞에서부터 한글 k글자만 풀어 보여 줌 (나머지는 초성)
function hintText(text, k) {
  let shown = 0;
  return [...text].map(c => (isSyllable(c) && shown++ >= k ? choOf(c) : c)).join('');
}

const QUIZ = [
  ['carol', '🎵 캐럴·겨울 노래', ['루돌프 사슴코', '징글벨', '고요한 밤 거룩한 밤', '울면 안 돼', '기쁘다 구주 오셨네', '화이트 크리스마스', '실버벨', '탄일종',
    '창밖을 보라', '크리스마스에는 축복을', '펠리스 나비다', '라스트 크리스마스', '산타 할아버지 우리 마을에 오시네', '흰 눈 사이로 썰매를 타고', '저 들 밖에 한밤중에',
    '북치는 소년', '렛 잇 고', '눈의 꽃', '크리스마스니까', '첫눈처럼 너에게 가겠다', '징글벨 록']],
  ['movie', '🎬 영화·드라마', ['나 홀로 집에', '러브 액츄얼리', '겨울왕국', '폴라 익스프레스', '그린치', '크리스마스의 악몽', '34번가의 기적', '8월의 크리스마스',
    '해리 포터와 마법사의 돌', '다이 하드', '러브레터', '엘프', '클라우스', '겨울연가', '도깨비', '로맨틱 홀리데이', '작은 아씨들', '나의 산타 할아버지']],
  ['food', '🍰 겨울 간식·음식', ['붕어빵', '군고구마', '호빵', '호떡', '계란빵', '군밤', '어묵', '고구마 라테', '핫초코', '뱅쇼', '딸기 케이크', '진저브레드', '슈톨렌', '파네토네',
    '떡국', '팥죽', '동치미', '칼국수', '곶감', '수정과', '식혜', '마시멜로', '로스트 치킨', '부시 드 노엘']],
  ['xmas', '🎄 크리스마스 낱말', ['산타클로스', '루돌프', '크리스마스트리', '눈사람', '썰매', '굴뚝', '크리스마스 양말', '선물 상자', '크리스마스 리스', '겨우살이',
    '진저브레드맨', '오너먼트', '지팡이 사탕', '크리스마스이브', '성탄절', '구세군 냄비', '메리 크리스마스', '산타 모자', '북극', '순록', '호두까기 인형', '눈꽃', '고드름',
    '이글루', '시크릿 산타']],
];
const quizOf = keys => QUIZ.filter(q => keys.includes(q[0])).flatMap(([key, , list]) => list.map(answer => ({ key, answer })));
// 이번에 낼 문제들: 고른 갈래에서 아직 안 낸 것을 섞어서. 다 냈으면 처음부터 다시
function quizDeck(keys, used) {
  const all = quizOf(keys), fresh = all.filter(q => !used.includes(q.answer));
  return cryptoShuffle(fresh.length ? fresh : all);
}
