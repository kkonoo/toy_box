'use strict';
// 방명록 계산 (화면 없음): guestbook.js 가 쓰고 tests/guestbook.test.js 가 Node에서 확인

const ATTEND = [[true, '✅', '왔어요'], [false, '🙅', '못 왔어요']]; // [came, 아이콘, 글]
const MAX_TITLE = 60, MAX_PLACE = 80, MAX_NAME = 20, MAX_MSG = 200, MAX_WISH = 200; // firestore.rules와 같은 수

// 'YYYY-MM-DD' → '12월 20일 (토)'
const WEEKDAYS = '일월화수목금토';
function dateLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}
const attendCount = list => ({ came: list.filter(e => e.came).length, missed: list.filter(e => !e.came).length });
// 단톡방에 같이 붙일 글 (링크는 따로)
const shareText = g => `${g.title}\n📅 ${dateLabel(g.date)}${g.place ? `\n📍 ${g.place}` : ''}\n방명록을 남겨 주세요. 못 오신 분도 남길 수 있어요.`;
