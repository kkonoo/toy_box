'use strict';
// 포트럭 계산 (화면 없음): potluck.js 가 쓰고 tests/potluck.test.js 가 Node에서 확인
// 카테고리마다 칸(가져올 사람 수)을 정해 두고 각자 신청. 마감할 때 아직 안 정한 사람은 남은 칸에 랜덤으로

// 기본 카테고리와 예시 메뉴 (한식·양식이 섞인 크리스마스 홈파티 기준). share = 인원 대비 칸 비율
const POT_CATS = [
  { name: '🥗 애피타이저', share: 0.17, ex: '카프레제 꼬치, 육전, 치즈 플래터, 카나페' },
  { name: '🍗 메인', share: 0.25, ex: '치킨 윙, 로스트비프, 보쌈, 감바스' },
  { name: '🍝 탄수화물', share: 0.15, ex: '잡채, 라자냐, 미니 김밥, 로제 떡볶이' },
  { name: '🥬 샐러드·사이드', share: 0.10, ex: '리코타 샐러드, 구운 채소, 무쌈' },
  { name: '🍰 디저트', share: 0.20, ex: '딸기 케이크, 브라우니, 쿠키, 과일' },
  { name: '🍷 음료', share: 0.13, ex: '와인, 맥주, 뱅쇼, 탄산수·주스' },
];
// 인원 n명 → 카테고리마다 칸 수 (합 = n). 비율대로 나누고 남는 칸은 소수점이 큰 쪽부터
function recommendSlots(n) {
  const raw = POT_CATS.map(c => c.share * n), slots = raw.map(Math.floor);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const short = n - slots.reduce((a, b) => a + b, 0);
  for (let k = 0; k < short; k++) slots[order[k % order.length][1]]++;
  return slots;
}
// 이름 비교: 띄어쓰기·대소문자만 달라도 같은 사람
const nameKey = s => s.toLowerCase().replace(/\s+/g, '');
const parseNames = v => v.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
// 카테고리마다 신청한 사람들 (넣은 순서)
const entriesIn = (entries, i) => entries.filter(e => e.cat === i).sort((a, b) => a.at - b.at);
const openSlots = (cats, entries) => cats.map((c, i) => Math.max(0, c.slots - entriesIn(entries, i).length));
// 남은 칸 랜덤 배정: names 가운데 아직 신청 안 한 사람을 빈 칸에 하나씩. 칸보다 사람이 많으면 남은 사람은 칸이 있는 카테고리 아무 데나
// → [{ name, cat }]
function fillRandom(cats, entries, names) {
  const done = new Set(entries.map(e => nameKey(e.name))), seen = new Set(), people = [];
  for (const n of names) { const k = nameKey(n); if (!done.has(k) && !seen.has(k)) { seen.add(k); people.push(n); } }
  const holes = cryptoShuffle(openSlots(cats, entries).flatMap((left, i) => Array(left).fill(i)));
  const any = cats.map((c, i) => i).filter(i => cats[i].slots > 0);
  return cryptoShuffle(people).map((name, k) => ({ name, cat: k < holes.length ? holes[k] : any[randInt(any.length)] }));
}
// 단톡방에 붙일 목록
function potluckText(title, cats, entries) {
  const lines = [title];
  cats.forEach((c, i) => {
    const list = entriesIn(entries, i);
    if (!c.slots && !list.length) return;
    lines.push('', `${c.name} ${list.length}/${c.slots}`);
    for (const e of list) lines.push(`- ${e.name}: ${e.dish || '메뉴 미정'}${e.host ? ' (랜덤)' : ''}`);
    for (let k = list.length; k < c.slots; k++) lines.push('- (빈 칸)');
  });
  return lines.join('\n');
}
