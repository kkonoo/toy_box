'use strict';
// 시크릿 산타 계산 (화면 없음): santa.js(주최자) · me.js(개인 화면)가 쓰고, tests/santa.test.js 가 Node에서 확인

// 이름 목록: 쉼표·줄바꿈으로 나누고 앞뒤 공백 뺌
const parseNames = v => v.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
// 겹치는 이름 (띄어쓰기·대소문자만 달라도 같은 이름으로 봄) → 링크를 받는 사람이 헷갈리지 않게 매칭 전에 알려 줌
function dupNames(names) {
  const seen = new Set(), dup = new Set();
  for (const x of names) { const k = x.toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) dup.add(x); seen.add(k); }
  return [...dup];
}

// 매칭: to[i] = i번이 선물할 사람 번호. 자기 자신은 안 뽑힘
// 섞어서 자기 자리에 남은 사람이 있으면 다시 섞기 (자기 자리가 없는 섞기는 모두 같은 확률, 평균 2.7번이면 끝남)
// 둘이 서로 뽑는 쌍(A→B, B→A)도 나올 수 있음
function matchSanta(n) {
  for (;;) {
    const to = cryptoShuffle([...Array(n).keys()]);
    if (to.every((t, i) => t !== i)) return to;
  }
}
// 추첨 번호: 다시 섞었을 때 예전 링크인지 알아보는 4글자 (헷갈리는 0·O·1·I는 뺌)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const drawCode = () => Array.from({ length: 4 }, () => CODE_CHARS[randInt(CODE_CHARS.length)]).join('');

// 개인 링크의 # 뒤: { d: 추첨 번호, g: 선물하는 사람, r: 받는 사람 } → 글자를 섞어 base64url
// 암호화는 아니고 링크를 봐도 이름이 바로 읽히지 않게만 함. # 뒤는 서버로 안 가서 GitHub Pages 기록에도 안 남음
const MASK = 'toybox-santa';
function encodeCard(card) {
  const bytes = new TextEncoder().encode(JSON.stringify(card)).map((b, i) => b ^ MASK.charCodeAt(i % MASK.length));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// 잘못된 링크면 null
function decodeCard(code) {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const card = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c, i) => c.charCodeAt(0) ^ MASK.charCodeAt(i % MASK.length))));
    return card && typeof card.g === 'string' && typeof card.r === 'string' && typeof card.d === 'string' ? card : null;
  } catch {
    return null;
  }
}
