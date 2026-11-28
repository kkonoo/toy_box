// 방명록 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('./load.js')('games/guestbook/guestbook-core.js');

test('날짜 글', () => {
  assert.equal(P.dateLabel('2026-12-19'), '12월 19일 (토)');
  assert.equal(P.dateLabel('2027-01-01'), '1월 1일 (금)');
});

test('왔어요 · 못 왔어요 세기', () => {
  assert.deepEqual({ ...P.attendCount([{ came: true }, { came: false }, { came: true }]) }, { came: 2, missed: 1 });
  assert.deepEqual({ ...P.attendCount([]) }, { came: 0, missed: 0 });
});

test('나눠 줄 글: 장소는 있을 때만', () => {
  assert.equal(P.shareText({ title: '연구실 송년회', date: '2026-12-19', place: '세미나실' }),
    '연구실 송년회\n📅 12월 19일 (토)\n📍 세미나실\n방명록을 남겨 주세요. 못 오신 분도 남길 수 있어요.');
  assert.ok(!P.shareText({ title: '집들이', date: '2026-12-19', place: '' }).includes('📍'));
});

test('글자 수 제한이 firestore.rules와 같음', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const part = rules.slice(rules.indexOf('// 방명록'), rules.indexOf('match /guestbooks/'));
  const max = f => Number(part.match(new RegExp(`d\\.${f}\\.size\\(\\) <= (\\d+)`))[1]);
  assert.deepEqual([max('title'), max('place'), max('name'), max('msg'), max('wish')], [P.MAX_TITLE, P.MAX_PLACE, P.MAX_NAME, P.MAX_MSG, P.MAX_WISH]);
});
