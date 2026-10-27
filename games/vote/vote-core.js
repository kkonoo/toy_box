'use strict';
// 투표 계산 (화면 없음): vote.js가 쓰고, tests/vote.test.js 가 Node에서 확인
// 투표 하나 = { title, kind: 'text'|'date', maxPick: 1(하나만)|0(제한 없음)|n, anonymous, allowAdd, results: 'always'|'voted'|'closed', closeAt: ms|null, closed }
// 항목 = { id, text, at: ms } — 날짜 투표의 text는 'YYYY-MM-DD' 또는 'YYYY-MM-DD HH:MM' (firestore.rules도 같은 꼴만 받음)
// 표 = { picks: [항목 id], name? } (익명 투표는 이름 없음)
const MAX_OPTIONS = 50, MAX_TEXT = 60, MAX_TITLE = 100, MAX_NAME = 20;

// 글 항목: 한 줄에 하나 (항목 안에 쉼표가 들어갈 수 있어서 쉼표로는 안 나눔), 앞뒤 공백 빼고, 겹치는 것 빼고
const sameKey = s => s.toLowerCase().replace(/\s+/g, ''); // 띄어쓰기·대소문자만 다르면 같은 항목
function parseItems(v) {
  const seen = new Set(), out = [];
  for (const s of v.split('\n').map(x => x.trim()).filter(Boolean)) if (!seen.has(sameKey(s))) { seen.add(sameKey(s)); out.push(s); }
  return out;
}
const hasItem = (options, text) => options.some(o => sameKey(o.text) === sameKey(text));

// ---------- 날짜 항목 ----------
const pad = n => String(n).padStart(2, '0');
const WHEN = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/;
// 'YYYY-MM-DD' + 'HH:MM'(없어도 됨) → 항목 글자. 없는 날짜(2월 30일 등)·시간이면 ''
function whenText(date, time) {
  const t = time ? `${date} ${time}` : date, m = WHEN.exec(t);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== m[2] - 1 || d.getUTCDate() !== +m[3]) return '';
  if (m[4] != null && (+m[4] > 23 || +m[5] > 59)) return '';
  return t;
}
// '2026-11-03 19:00' → '11월 3일 (화) 오후 7:00'. 올해가 아니면 앞에 연도
const WEEK = '일월화수목금토';
function whenLabel(text, now = Date.now()) {
  const m = WHEN.exec(text);
  if (!m) return text;
  const y = +m[1], mo = +m[2], d = +m[3], day = WEEK[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  let s = `${y === new Date(now).getFullYear() ? '' : `${y}년 `}${mo}월 ${d}일 (${day})`;
  if (m[4] != null) { const hh = +m[4]; s += ` ${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${m[5]}`; }
  return s;
}
// 달력 한 달: 'YYYY-MM' → 일요일부터 맞춘 앞 빈칸('')과 그달 날짜들('YYYY-MM-DD')
function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number), first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [...Array(first).fill(''), ...Array.from({ length: n }, (_, i) => `${ym}-${pad(i + 1)}`)];
}
const addMonth = (ym, k) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5) - 1 + k, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
// 시각(ms) → 이 기기 시간대의 'YYYY-MM-DD HH:MM' (마감 시간 보여 주기·입력 칸)
const whenOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const optionLabel = (poll, o, now) => (poll.kind === 'date' ? whenLabel(o.text, now) : o.text);
// 항목 순서: 날짜는 이른 날부터, 글 항목은 올린 순서 (만들 때 한 번에 넣은 항목은 시간이 같아서 id '00'·'01'… 순서)
function sortOptions(poll, options) {
  return [...options].sort(poll.kind === 'date' ? (a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)
    : (a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ---------- 고르기·마감·결과 ----------
const pickLimit = poll => poll.maxPick || Infinity;
// 항목 누르기: 하나만 고르는 투표는 바꾸기, 여러 개는 켜고 끄기 (최대 개수가 차면 더 안 켜짐)
function togglePick(picks, id, limit) {
  if (picks.includes(id)) return picks.filter(x => x !== id);
  if (limit === 1) return [id];
  return picks.length < limit ? [...picks, id] : picks;
}
const isClosed = (poll, now) => poll.closed || (poll.closeAt != null && now >= poll.closeAt);
// 모든 표를 볼 수 있는지 (firestore.rules canSee와 같은 규칙: 주최자도 똑같음)
const canSeeResults = (poll, voted, now) => poll.results === 'always' || isClosed(poll, now) || (poll.results === 'voted' && voted);

// 항목별 표 수와 고른 사람 이름. 지워진 항목을 고른 표는 셈에서 빠지고, 한 표에 같은 항목이 두 번 있어도 한 번만
function tally(options, votes) {
  const rows = new Map(options.map(o => [o.id, { count: 0, names: [] }]));
  for (const v of votes) {
    for (const id of new Set(v.picks)) {
      const r = rows.get(id);
      if (!r) continue;
      r.count++;
      if (v.name) r.names.push(v.name);
    }
  }
  return { rows, max: Math.max(0, ...[...rows.values()].map(r => r.count)), voters: votes.length };
}

// 만들기 확인: 문제가 있으면 그 까닭(화면에 그대로), 없으면 ''
// 항목 추가를 켜면 항목 없이 시작해도 됨 (의견 모으기)
function pollProblem(d, now) {
  if (!d.title.trim()) return '질문을 적어 주세요';
  if (d.title.trim().length > MAX_TITLE) return `질문은 ${MAX_TITLE}자까지예요`;
  const long = d.items.find(s => s.length > MAX_TEXT);
  if (long) return `항목은 ${MAX_TEXT}자까지예요: ${long.slice(0, 12)}…`;
  if (d.items.length > MAX_OPTIONS) return `항목은 ${MAX_OPTIONS}개까지예요 (지금 ${d.items.length}개)`;
  if (d.items.length < 2 && !d.allowAdd) return '항목을 2개 이상 넣거나, 다른 사람도 항목 추가를 켜 주세요';
  if (d.closeAt != null && !(d.closeAt > now)) return '마감 시간을 지금보다 뒤로 정해 주세요';
  return '';
}
