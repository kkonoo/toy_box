'use strict';
// 선물 뺏기 (화이트 엘리펀트) 계산 (화면 없음): swap.js 가 쓰고 tests/swap.test.js 가 Node에서 확인
// 각자 포장한 선물을 하나씩 쌓아 두고, 섞은 순서대로 '새 선물 열기' 또는 '열린 선물 뺏기'
// 뺏긴 사람은 바로 자기 차례(새로 열거나 다른 걸 뺏음, 방금 뺏긴 선물을 바로 되뺏기는 안 됨). 새 선물을 열면 다음 순서로
// 한 선물은 limit번까지만 뺏김(0 = 제한 없음). 모두 하나씩 들면 끝
// game = { order: [이름], limit, next: 다음 순서 자리, actor: 지금 할 사람(끝나면 null), gifts: [{ label, holder, steals }], noBack: 되뺏기 안 되는 선물 번호(-1 = 없음) }

const parseNames = v => v.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
function newSwap(names, limit) {
  const order = cryptoShuffle(names);
  return { order, limit, next: 1, actor: order[0], gifts: [], noBack: -1 };
}
const pileLeft = g => g.order.length - g.gifts.length;
const holderOf = (g, name) => g.gifts.findIndex(x => x.holder === name);
// 뺏을 수 없는 까닭 (뺏을 수 있으면 '')
function stealBlock(g, i) {
  const x = g.gifts[i];
  if (g.actor == null) return '끝났어요';
  if (i === g.noBack) return '방금 뺏긴 선물';
  if (g.limit && x.steals >= g.limit) return '더 못 뺏어요';
  return '';
}
function openGift(g, label) {
  const gifts = [...g.gifts, { label, holder: g.actor, steals: 0 }], done = g.next >= g.order.length;
  return { ...g, gifts, actor: done ? null : g.order[g.next], next: g.next + 1, noBack: -1 };
}
function stealGift(g, i) {
  const victim = g.gifts[i].holder, gifts = g.gifts.map((x, k) => (k === i ? { ...x, holder: g.actor, steals: x.steals + 1 } : x));
  return { ...g, gifts, actor: victim, noBack: i };
}
