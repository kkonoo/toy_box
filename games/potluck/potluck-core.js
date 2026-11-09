'use strict';
// 포트럭 계산 (화면 없음): potluck.js 가 쓰고 tests/potluck.test.js 가 Node에서 확인
// 카테고리마다 칸(가져올 사람 수)을 정해 두고 각자 신청. 마감할 때 아직 안 정한 사람은 남은 칸에 랜덤으로

// 기본 카테고리와 예시 메뉴 (한식·양식이 섞인 크리스마스 홈파티·연구실 포트럭 추천 글에 나온 메뉴 전부). share = 인원 대비 칸 비율
// 예시는 신청할 때 칩으로 보이고 누르면 메뉴 칸에 들어감. 포트럭에는 'a, b, c' 글로 저장 (그래서 메뉴 이름 안엔 쉼표를 안 씀)
const POT_CATS = [
  { name: '🥗 애피타이저', share: 0.17, ex: ['육전', '떡갈비 꼬치', '카프레제 꼬치', '치즈 플래터', '치즈 & 크래커 플래터', '카나페 (훈제연어·크림치즈)', '미트볼 꼬치', '감바스',
    '브루스케타', '과일 & 하몽 플래터', '크랜베리 브리치즈'] },
  { name: '🍗 메인', share: 0.25, ex: ['허니갈릭 치킨 윙', '간장 치킨 윙', '로스트비프', '수육', '보쌈', '새우 감바스', '불고기 쌈', '로스트 치킨', '통닭', '바비큐 폭립', '풀드포크',
    '미트볼 토마토소스', '찹스테이크', '훈제연어', '새우구이'] },
  { name: '🍝 탄수화물', share: 0.15, ex: ['잡채', '라자냐', '미니 김밥', '로제 떡볶이', '크림 파스타', '토마토 파스타', '감자 그라탕', '로스트 포테이토', '갈릭 브레드', '볶음밥'] },
  { name: '🥬 샐러드·사이드', share: 0.10, ex: ['리코타 치즈 샐러드', '딸기 샐러드', '구운 채소 플래터', '피클', '무쌈'] },
  { name: '🍰 디저트', share: 0.20, ex: ['딸기 생크림 케이크', '브라우니', '마카롱', '미니 타르트', '쿠키', '마들렌', '티라미수', '크리스마스 컵케이크', '과일 플래터 (딸기·포도)'] },
  { name: '🍷 음료', share: 0.13, ex: ['레드와인', '화이트와인', '스파클링 와인', '맥주', '뱅쇼', '크랜베리 오렌지 펀치', '무알콜 샹그리아', '탄산수', '콜라', '주스', '무알콜 음료', '커피', '티'] },
];
// 포트럭에 저장한 예시 글('a, b, c', 예전에 만든 포트럭도 같은 꼴) → 목록
const exList = ex => (Array.isArray(ex) ? ex : String(ex || '').split(', ').filter(Boolean));
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
