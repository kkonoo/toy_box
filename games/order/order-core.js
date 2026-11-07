'use strict';
// 주문 모으기 계산 (화면 없음): order.js 가 쓰고, tests/order.test.js 가 Node에서 확인

const MENU_MAX = 80; // 메뉴 줄 수 (사진을 잘못 읽어 너무 길어지지 않게)
const NAME_MAX = 40; // 메뉴 이름 글자 수

// 적은 글 → 메뉴 이름들: 한 줄에 하나, 앞뒤 빈칸·빈 줄·겹치는 이름 빼고
const parseMenu = text => cleanNames(String(text).split('\n'));
function cleanNames(list) {
  const out = [];
  for (const v of list) {
    const name = String(v).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
    if (name && !out.includes(name)) out.push(name);
  }
  return out.slice(0, MENU_MAX);
}
// 지금 메뉴 글에 새로 읽은 이름 붙이기 (이미 있는 이름은 빼고)
const addNames = (text, names) => cleanNames([...parseMenu(text), ...names]).join('\n');

// 개수 → 바를 정(正) 획 묶음: 12 → [5, 5, 2]
function tallyGroups(n) {
  const out = [];
  for (let left = Math.max(0, Math.floor(n)); left > 0; left -= 5) out.push(Math.min(5, left));
  return out;
}

// 메뉴가 바뀔 때 개수 옮기기: 남은 메뉴는 개수 그대로, 빠진 메뉴 중 개수가 있던 것은 dropped로 알려 줌
function keepCounts(counts, menu) {
  const kept = {}, dropped = [];
  for (const [name, n] of Object.entries(counts)) {
    if (!(n > 0)) continue;
    if (menu.includes(name)) kept[name] = n; else dropped.push([name, n]);
  }
  return { counts: kept, dropped };
}
const totalOf = counts => Object.values(counts).reduce((s, n) => s + (n > 0 ? n : 0), 0);

// 카운터에 보여 주거나 단톡방에 붙여 넣을 글 (메뉴 순서, 0개는 빼고)
function orderText(menu, counts) {
  const lines = menu.filter(name => counts[name] > 0).map(name => `${name} ${counts[name]}`);
  return [`☕ 주문 (모두 ${totalOf(counts)}잔)`, ...lines].join('\n');
}

// 사진 줄이기: 긴 쪽을 max 이하로 (작으면 그대로)
function fitSize(w, h, max) {
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

// ---------- 📷 메뉴판 읽기: Claude에게 보내는 글과 받을 모양 ----------
const MENU_PROMPT = `이 사진은 카페나 식당의 메뉴판이에요. 주문할 수 있는 메뉴 이름을 모두 뽑아 items에 넣어 주세요.
- 메뉴판에 보이는 순서대로, 같은 메뉴는 한 번만
- 메뉴판에 적힌 이름 그대로. 한국어와 영어가 같이 적혀 있으면 한국어 이름만
- 가격, 용량, 설명, HOT/ICE 표시, 분류 제목(예: COFFEE, 음료, 디저트)은 빼고 메뉴 이름만
- 메뉴판이 아니거나 읽을 수 있는 메뉴가 없으면 빈 목록`;
const MENU_SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'string' } } },
  required: ['items'],
  additionalProperties: false,
};
// Claude 답(JSON 글) → 메뉴 이름들. 모양이 다르면 빈 목록
function parseMenuReply(text) {
  try {
    const items = JSON.parse(text)?.items;
    return Array.isArray(items) ? cleanNames(items.filter(v => typeof v === 'string')) : [];
  } catch { return []; }
}
