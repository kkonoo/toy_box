// 투표 계산 확인: node --test (저장소 맨 위에서)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./load.js')('games/vote/vote-core.js');

const NOW = new Date(2026, 9, 27, 12, 0).getTime(); // 2026-10-27 12:00

test('글 항목: 한 줄에 하나, 쉼표는 그대로, 겹치는 것 빼기', () => {
  assert.deepEqual([...P.parseItems(' 짜장면\n\n짬뽕, 탕수육 세트 \n짜 장면\nPIZZA\npizza')], ['짜장면', '짬뽕, 탕수육 세트', 'PIZZA']);
  assert.equal(P.hasItem([{ text: '짜장면' }], ' 짜장 면'), true);
  assert.equal(P.hasItem([{ text: '짜장면' }], '짬뽕'), false);
});

test('날짜 항목: 있는 날짜·시간만', () => {
  assert.equal(P.whenText('2026-11-03', ''), '2026-11-03');
  assert.equal(P.whenText('2026-11-03', '19:00'), '2026-11-03 19:00');
  for (const [d, t] of [['2026-02-30', ''], ['2026-13-01', ''], ['2026-11-03', '24:00'], ['2026-11-03', '7:00'], ['', '19:00'], ['다음 주', '']]) {
    assert.equal(P.whenText(d, t), '', `${d} ${t}`);
  }
  assert.equal(P.whenText('2028-02-29', ''), '2028-02-29');
});

test('날짜 이름: 요일·오전 오후, 올해가 아니면 연도', () => {
  assert.equal(P.whenLabel('2026-11-03', NOW), '11월 3일 (화)');
  assert.equal(P.whenLabel('2026-11-03 19:05', NOW), '11월 3일 (화) 오후 7:05');
  assert.equal(P.whenLabel('2026-11-03 00:30', NOW), '11월 3일 (화) 오전 12:30');
  assert.equal(P.whenLabel('2026-11-03 12:00', NOW), '11월 3일 (화) 오후 12:00');
  assert.equal(P.whenLabel('2027-01-01', NOW), '2027년 1월 1일 (금)');
  assert.equal(P.whenOf(new Date(2026, 10, 3, 9, 5).getTime()), '2026-11-03 09:05');
});

test('달력: 일요일부터 빈칸, 달 넘기기', () => {
  const nov = P.monthDays('2026-11'); // 11월 1일은 일요일
  assert.equal(nov.length, 30);
  assert.equal(nov[0], '2026-11-01');
  const oct = P.monthDays('2026-10'); // 10월 1일은 목요일 → 빈칸 4개
  assert.deepEqual([...oct.slice(0, 5)], ['', '', '', '', '2026-10-01']);
  assert.equal(oct.at(-1), '2026-10-31');
  assert.equal(P.monthDays('2028-02').filter(Boolean).length, 29);
  assert.equal(P.addMonth('2026-12', 1), '2027-01');
  assert.equal(P.addMonth('2026-01', -1), '2025-12');
  assert.equal(P.addMonth('2026-10', 0), '2026-10');
});

test('항목 순서: 날짜는 이른 날부터, 글은 올린 순서', () => {
  const ids = list => list.map(o => o.id).join(',');
  const dates = [{ id: 'a', text: '2026-11-04', at: 1 }, { id: 'b', text: '2026-11-03 19:00', at: 2 }, { id: 'c', text: '2026-11-03', at: 3 }];
  assert.equal(ids(P.sortOptions({ kind: 'date' }, dates)), 'c,b,a');
  const texts = [{ id: 'zz', text: '나중', at: 9 }, { id: '01', text: '둘', at: 5 }, { id: '00', text: '하나', at: 5 }];
  assert.equal(ids(P.sortOptions({ kind: 'text' }, texts)), '00,01,zz');
});

test('고르기: 하나만이면 바꾸고, 여러 개면 최대까지 켜고 끄기', () => {
  assert.deepEqual([...P.togglePick(['a'], 'b', 1)], ['b']);
  assert.deepEqual([...P.togglePick(['a'], 'a', 1)], []);
  assert.deepEqual([...P.togglePick(['a'], 'b', 2)], ['a', 'b']);
  assert.deepEqual([...P.togglePick(['a', 'b'], 'c', 2)], ['a', 'b']);
  assert.deepEqual([...P.togglePick(['a', 'b'], 'a', 2)], ['b']);
  assert.equal(P.pickLimit({ maxPick: 0 }), Infinity);
  assert.equal(P.pickLimit({ maxPick: 3 }), 3);
});

test('마감·결과 보기', () => {
  const p = (x = {}) => ({ results: 'always', closed: false, closeAt: null, ...x });
  assert.equal(P.isClosed(p(), NOW), false);
  assert.equal(P.isClosed(p({ closed: true }), NOW), true);
  assert.equal(P.isClosed(p({ closeAt: NOW }), NOW), true);
  assert.equal(P.isClosed(p({ closeAt: NOW + 1 }), NOW), false);
  assert.equal(P.canSeeResults(p(), false, NOW), true);
  assert.equal(P.canSeeResults(p({ results: 'voted' }), false, NOW), false);
  assert.equal(P.canSeeResults(p({ results: 'voted' }), true, NOW), true);
  assert.equal(P.canSeeResults(p({ results: 'closed' }), true, NOW), false);
  assert.equal(P.canSeeResults(p({ results: 'closed', closeAt: NOW - 1 }), false, NOW), true);
});

test('세기: 이름, 지워진 항목·겹친 고르기는 빼고', () => {
  const opts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const t = P.tally(opts, [{ picks: ['a', 'b'], name: '민지' }, { picks: ['a', 'a', 'gone'], name: '서준' }, { picks: ['b'] }]);
  assert.deepEqual({ ...t.rows.get('a') }, { count: 2, names: ['민지', '서준'] });
  assert.deepEqual({ ...t.rows.get('b') }, { count: 2, names: ['민지'] });
  assert.equal(t.rows.get('c').count, 0);
  assert.equal(t.max, 2);
  assert.equal(t.voters, 3);
  assert.equal(P.tally(opts, []).max, 0);
});

test('만들기 확인', () => {
  const d = (x = {}) => ({ title: '점심', items: ['짜장', '짬뽕'], allowAdd: false, closeAt: null, ...x });
  assert.equal(P.pollProblem(d(), NOW), '');
  assert.match(P.pollProblem(d({ title: '  ' }), NOW), /질문/);
  assert.match(P.pollProblem(d({ items: ['짜장'] }), NOW), /2개 이상/);
  assert.equal(P.pollProblem(d({ items: [], allowAdd: true }), NOW), '');
  assert.match(P.pollProblem(d({ items: ['짜장', 'x'.repeat(61)] }), NOW), /60자/);
  assert.match(P.pollProblem(d({ items: Array.from({ length: 51 }, (_, i) => `${i}`) }), NOW), /50개/);
  assert.match(P.pollProblem(d({ closeAt: NOW }), NOW), /마감 시간/);
  assert.equal(P.pollProblem(d({ closeAt: NOW + 60000 }), NOW), '');
});
