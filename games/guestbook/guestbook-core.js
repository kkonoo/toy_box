'use strict';
// 방명록 계산 (화면 없음): guestbook.js 가 쓰고 tests/guestbook.test.js 가 Node에서 확인

const ATTEND = [[true, '✅', '왔어요'], [false, '🙅', '못 왔어요']]; // [came, 아이콘, 글]
const MAX_TITLE = 60, MAX_PLACE = 80, MAX_NAME = 20, MAX_MSG = 200, MAX_WISH = 200; // firestore.rules와 같은 수

// 'YYYY-MM-DD' → '토', '12월 20일 (토)'
const WEEKDAYS = '일월화수목금토';
const weekday = date => { const [y, m, d] = date.split('-').map(Number); return WEEKDAYS[new Date(y, m - 1, d).getDay()]; };
function dateLabel(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일 (${weekday(date)})`;
}
const attendCount = list => ({ came: list.filter(e => e.came).length, missed: list.filter(e => !e.came).length });
// 단톡방에 같이 붙일 글 (링크는 따로)
const shareText = g => `${g.title}\n📅 ${dateLabel(g.date)}${g.place ? `\n📍 ${g.place}` : ''}\n방명록을 남겨 주세요. 못 오신 분도 남길 수 있어요.`;

// ---------- 엑셀로 받기 ----------
// 줄 = { s: 모양, cells: [글…] }. 모양 0 보통 · 1 굵게 · 2 줄바꿈(위 맞춤)
// 위에 행사 정보, 한 줄 띄고 표. 왔어요 먼저, 같은 쪽은 남긴 순서 (화면과 같은 순서)
const pad2 = n => String(n).padStart(2, '0');
const stamp = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const EXPORT_WIDTHS = [14, 11, 42, 42, 17];
function exportRows(g, entries) {
  const n = attendCount(entries), list = [...entries].sort((a, b) => (b.came - a.came) || (a.at - b.at));
  return [
    { s: 1, cells: [g.title] },
    { s: 0, cells: ['날짜', `${g.date} (${weekday(g.date)})`] },
    ...(g.place ? [{ s: 0, cells: ['장소', g.place] }] : []),
    { s: 0, cells: ['참석', `왔어요 ${n.came}명 · 못 왔어요 ${n.missed}명`] },
    { s: 0, cells: [] },
    { s: 1, cells: ['이름', '참석', '남길 말', '다음에 바라는 점', '남긴 시각'] },
    ...list.map(e => ({ s: 2, cells: [e.name, e.came ? '왔어요' : '못 왔어요', e.msg, e.wish, e.at ? stamp(e.at) : ''] })),
  ];
}
// 파일 이름: 방명록_행사 이름_날짜.xlsx (파일 이름에 못 쓰는 글자는 _)
const exportName = g => `방명록_${g.title}_${g.date}.xlsx`.replace(/[\\/:*?"<>|\r\n]/g, '_');

// 엑셀 파일(.xlsx) 만들기: 시트 하나, 글은 모두 글자 칸(= - 로 시작해도 수식이 안 됨). 라이브러리 없이 XML 몇 개를 압축 없는 zip으로 묶음
const xmlText = s => String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colName = i => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
function xlsxBytes(sheetName, rows, widths) {
  const NS = 'http://schemas.openxmlformats.org', head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const rel = (id, type, target) => `<Relationship Id="${id}" Type="${NS}/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  const font = b => `<font>${b ? '<b/>' : ''}<sz val="11"/><name val="맑은 고딕"/></font>`;
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const data = rows.map((row, r) => `<row r="${r + 1}">${row.cells.map((v, c) => (v === '' || v == null ? ''
    : `<c r="${colName(c)}${r + 1}" s="${row.s}" t="inlineStr"><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`)).join('')}</row>`).join('');
  const files = [
    ['[Content_Types].xml', `<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', `<Relationships xmlns="${NS}/package/2006/relationships">${rel('rId1', 'officeDocument', 'xl/workbook.xml')}</Relationships>`],
    ['xl/workbook.xml', `<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="${xmlText(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<Relationships xmlns="${NS}/package/2006/relationships">${rel('rId1', 'worksheet', 'worksheets/sheet1.xml')}${rel('rId2', 'styles', 'styles.xml')}</Relationships>`],
    ['xl/styles.xml', `<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="2">${font(false)}${font(true)}</fonts>`
      + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
      + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml', `<worksheet xmlns="${NS}/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`],
  ];
  return zipStore(files.map(([name, xml]) => [name, new TextEncoder().encode(head + xml)]));
}
// 압축 없는(store) zip: [[이름, 바이트]] → Uint8Array
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = bytes => { let c = 0xFFFFFFFF; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) {
  const parts = [], dir = [];
  let offset = 0;
  // 머리: 4바이트 표시 + [[바이트 수(2·4), 값]…], 리틀 엔디언
  const header = (sig, fields) => {
    const b = new DataView(new ArrayBuffer(fields.reduce((sum, [n]) => sum + n, 4)));
    b.setUint32(0, sig, true);
    let p = 4;
    for (const [n, v] of fields) { if (n === 2) b.setUint16(p, v, true); else b.setUint32(p, v, true); p += n; }
    return new Uint8Array(b.buffer);
  };
  for (const [name, data] of files) {
    const nb = new TextEncoder().encode(name), crc = crc32(data), date = 33; // 1980-01-01 00:00
    const common = [[2, 20], [2, 0], [2, 0], [2, 0], [2, date], [4, crc], [4, data.length], [4, data.length], [2, nb.length], [2, 0]];
    parts.push(header(0x04034b50, common), nb, data);
    dir.push(header(0x02014b50, [[2, 20], ...common, [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]]), nb);
    offset += 30 + nb.length + data.length;
  }
  const dirSize = dir.reduce((s, b) => s + b.length, 0);
  const end = header(0x06054b50, [[2, 0], [2, 0], [2, files.length], [2, files.length], [4, dirSize], [4, offset], [2, 0]]);
  const out = new Uint8Array(offset + dirSize + end.length);
  let p = 0;
  for (const b of [...parts, ...dir, end]) { out.set(b, p); p += b.length; }
  return out;
}
