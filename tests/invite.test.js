// 초대장 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('games/invite/invite-core.js');

test('날짜·시간 글', () => {
  assert.equal(P.dateLabel('2026-12-19'), '12월 19일 (토)');
  assert.equal(P.dateLabel('2026-12-25'), '12월 25일 (금)');
  assert.equal(P.timeLabel('18:00'), '오후 6:00');
  assert.equal(P.timeLabel('00:05'), '오전 12:05');
  assert.equal(P.timeLabel('12:30'), '오후 12:30');
  assert.equal(P.timeLabel('09:00'), '오전 9:00');
  assert.equal(P.whenLabel('2026-12-19', '18:00', '21:30'), '12월 19일 (토) 오후 6:00 ~ 오후 9:30');
  assert.equal(P.whenLabel('2026-12-19', '18:00', ''), '12월 19일 (토) 오후 6:00');
});

test('디데이: 해·달이 바뀌어도, 지나면 빈 글', () => {
  assert.equal(P.dday('2026-12-19', '2026-11-26'), 'D-23');
  assert.equal(P.dday('2027-01-02', '2026-12-31'), 'D-2');
  assert.equal(P.dday('2026-12-19', '2026-12-19'), 'D-DAY');
  assert.equal(P.dday('2026-12-19', '2026-12-20'), '');
});

test('식순: 앞의 시간을 떼고, 시간 없는 줄·빈 줄도', () => {
  assert.deepEqual(P.parseProgram('18:00 모여서 인사\n\n 6:30 - 식사 \n마무리\n21:00'), [
    { time: '18:00', text: '모여서 인사' }, { time: '6:30', text: '식사' }, { time: '', text: '마무리' }, { time: '21:00', text: '' }]);
  assert.equal(P.parseProgram(P.PROGRAM_EXAMPLE).length, 5);
  assert.ok(P.PROGRAM_EXAMPLE.length <= P.MAX_PROGRAM);
});

test('링크: 글 속 주소만 떼어 냄, 끝의 마침표·괄호는 글로', () => {
  assert.deepEqual(P.linkParts('포트럭 신청: https://a.io/games/potluck/#x1 꼭!'), [{ text: '포트럭 신청: ' }, { url: 'https://a.io/games/potluck/#x1' }, { text: ' 꼭!' }]);
  assert.deepEqual(P.linkParts('(https://a.io/x).'), [{ text: '(' }, { url: 'https://a.io/x' }, { text: ').' }]);
  assert.deepEqual(P.linkParts('주소 없음'), [{ text: '주소 없음' }]);
  assert.deepEqual(P.linkParts('javascript:alert(1)'), [{ text: 'javascript:alert(1)' }]);
});

test('답장 세기와 지도 주소', () => {
  assert.deepEqual({ ...P.rsvpCount([{ answer: 'yes' }, { answer: 'no' }, { answer: 'yes' }]) }, { yes: 2, maybe: 0, no: 1 });
  assert.equal(P.mapUrl('연구실 3층 세미나실'), 'https://map.naver.com/p/search/%EC%97%B0%EA%B5%AC%EC%8B%A4%203%EC%B8%B5%20%EC%84%B8%EB%AF%B8%EB%82%98%EC%8B%A4');
});
