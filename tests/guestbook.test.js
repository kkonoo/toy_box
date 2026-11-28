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

test('엑셀 줄: 행사 정보, 표 머리, 왔어요 먼저·남긴 순서, 장소 없으면 그 줄 빼기', () => {
  const at = (h, m) => new Date(2026, 11, 19, h, m).getTime();
  const entries = [
    { name: '나중 손님', came: true, msg: '', wish: '', at: at(20, 5) },
    { name: '못 온 사람', came: false, msg: '', wish: '평일이면 좋겠어요', at: at(17, 0) },
    { name: '먼저 손님', came: true, msg: '좋았어요\n또 와요', wish: '', at: at(18, 30) },
  ];
  const rows = P.exportRows({ title: '연구실 송년회', date: '2026-12-19', place: '세미나실' }, entries);
  assert.deepEqual(rows.slice(0, 6).map(r => r.cells), [
    ['연구실 송년회'], ['날짜', '2026-12-19 (토)'], ['장소', '세미나실'], ['참석', '왔어요 2명 · 못 왔어요 1명'], [],
    ['이름', '참석', '남길 말', '다음에 바라는 점', '남긴 시각']]);
  assert.deepEqual(rows.slice(6).map(r => r.cells), [
    ['먼저 손님', '왔어요', '좋았어요\n또 와요', '', '2026-12-19 18:30'],
    ['나중 손님', '왔어요', '', '', '2026-12-19 20:05'],
    ['못 온 사람', '못 왔어요', '', '평일이면 좋겠어요', '2026-12-19 17:00']]);
  assert.ok(!P.exportRows({ title: 't', date: '2026-12-19', place: '' }, []).some(r => r.cells[0] === '장소'));
  assert.equal(P.exportRows({ title: 't', date: '2026-12-19', place: '' }, []).at(-1).cells[0], '이름');
});

test('엑셀 파일 이름: 못 쓰는 글자는 _', () => {
  assert.equal(P.exportName({ title: '송년회 1/2: "A"', date: '2026-12-19' }), '방명록_송년회 1_2_ _A__2026-12-19.xlsx');
});

test('엑셀 파일: zip 안에 6개 파일, CRC가 맞고, 글은 모두 글자 칸', () => {
  const zlib = require('node:zlib');
  const rows = [{ s: 1, cells: ['이름', '남길 말'] }, { s: 2, cells: ['<김&밥>', '=1+1'] }, { s: 2, cells: ['', '-좋았어요'] }];
  const buf = Buffer.from(P.xlsxBytes('방명록', rows, [10, 30]));
  const end = buf.length - 22;
  assert.equal(buf.readUInt32LE(end), 0x06054b50);
  const n = buf.readUInt16LE(end + 10), files = {};
  for (let i = 0, p = buf.readUInt32LE(end + 16); i < n; i++) {
    const crc = buf.readUInt32LE(p + 16), size = buf.readUInt32LE(p + 24), nameLen = buf.readUInt16LE(p + 28), local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26), data = buf.subarray(start, start + size);
    assert.equal(buf.readUInt32LE(local), 0x04034b50);
    assert.equal(zlib.crc32(data), crc, name);
    files[name] = data.toString('utf8');
    p += 46 + nameLen;
  }
  assert.deepEqual(Object.keys(files), ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']);
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('<c r="A2" s="2" t="inlineStr"><is><t xml:space="preserve">&lt;김&amp;밥&gt;</t></is></c>'));
  assert.ok(sheet.includes('<c r="B2" s="2" t="inlineStr"><is><t xml:space="preserve">=1+1</t></is></c>'));
  assert.ok(!sheet.includes('r="A3"'), '빈 칸은 안 씀');
  assert.ok(!sheet.includes('<f>'), '수식 없음');
  assert.equal(P.colName(0) + P.colName(25) + P.colName(26) + P.colName(27), 'AZAAAB');
});
