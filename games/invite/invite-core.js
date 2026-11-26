'use strict';
// 초대장 계산 (화면 없음): invite.js 가 쓰고 tests/invite.test.js 가 Node에서 확인

const RSVP = [['yes', '🙋', '갈게요'], ['maybe', '🤔', '아직 몰라요'], ['no', '🙅', '못 가요']];
const MAX_TITLE = 60, MAX_PLACE = 80, MAX_PROGRAM = 600, MAX_NOTE = 400, MAX_NAME = 20, MAX_MSG = 60; // firestore.rules와 같은 수
const PROGRAM_EXAMPLE = '18:00 모여서 인사\n18:30 포트럭 식사 🍗\n19:30 선물 주인 맞히기 🕵️\n20:00 초성 퀴즈 · 몸으로 말해요\n21:00 단체 사진 📸';

// 'YYYY-MM-DD' → '12월 20일 (토)', 'HH:MM' → '오후 6:00'
const WEEKDAYS = '일월화수목금토';
function dateLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}
function timeLabel(time) {
  const [h, m] = time.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}
const whenLabel = (date, time, until) => `${dateLabel(date)} ${timeLabel(time)}${until ? ` ~ ${timeLabel(until)}` : ''}`;
// 남은 날 (today = 'YYYY-MM-DD'): 'D-3' · 'D-DAY' · 지났으면 ''
function dday(date, today) {
  const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const n = Math.round((utc(date) - utc(today)) / 864e5);
  return n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : '';
}
// 식순: 한 줄에 하나. 앞에 '18:00'·'6:30'이 있으면 시간으로 → [{ time, text }]
function parseProgram(text) {
  return text.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const m = line.match(/^(\d{1,2}:\d{2})\s*[-–~·]?\s*(.*)$/);
    return m ? { time: m[1], text: m[2] } : { time: '', text: line };
  });
}
// 글 속 주소를 누를 수 있게 나눔: [{ text } | { url }]. 주소 끝에 붙은 마침표·괄호는 글로
function linkParts(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const url = m[0].replace(/[.,!?)\]]+$/, '');
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ url });
    last = m.index + url.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
const rsvpCount = list => Object.fromEntries(RSVP.map(([k]) => [k, list.filter(r => r.answer === k).length]));
const mapUrl = place => `https://map.naver.com/p/search/${encodeURIComponent(place)}`;
