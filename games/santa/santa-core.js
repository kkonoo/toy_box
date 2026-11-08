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

// 위시리스트 id: 사람마다 하나. 주최자가 매칭할 때 만들어 링크에만 넣음 (본인 링크 w = 쓰기, 나를 뽑은 산타 링크 rw = 읽기)
// 이 id를 알아야 위시리스트를 읽고 쓸 수 있어서 길게 16글자. firestore.rules도 이 꼴만 받음
const WISH_ID = /^[A-HJ-NP-Z2-9]{16}$/;
const wishId = () => Array.from({ length: 16 }, () => CODE_CHARS[randInt(CODE_CHARS.length)]).join('');
const MAX_WISHES = 10, MAX_WISH_NAME = 60, MAX_WISH_LINK = 1000; // firestore.rules와 같은 수
// 위시 참고 링크: 쇼핑 앱 '공유 › 복사'처럼 글과 주소가 섞여 있으면 주소만 꺼내고, 'naver.me/abc'처럼 앞이 없으면 https:// 붙임
// 빈칸이면 '', 주소로 못 읽으면 null
function wishLink(text) {
  const s = text.trim();
  if (!s) return '';
  const found = s.match(/https?:\/\/\S+/i);
  const raw = found ? found[0] : /^[^\s/]+\.[^\s]+$/.test(s) ? `https://${s}` : null;
  try {
    const u = new URL(raw);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') && u.href.length <= MAX_WISH_LINK ? u.href : null;
  } catch {
    return null;
  }
}

// 개인 링크의 # 뒤: { d: 추첨 번호, g: 선물하는 사람, r: 받는 사람, w: 내 위시리스트 id, rw: 받는 사람 위시리스트 id } → 글자를 섞어 base64url
// w·rw는 위시리스트가 생기기 전에 만든 링크엔 없음
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
    const wishOk = v => v === undefined || (typeof v === 'string' && WISH_ID.test(v));
    return card && typeof card.g === 'string' && typeof card.r === 'string' && typeof card.d === 'string' && wishOk(card.w) && wishOk(card.rw) ? card : null;
  } catch {
    return null;
  }
}

// ---------- 선물 주인 맞히기 (파티에서, 매칭한 기기) ----------
// order = 맞히는 순서(이름들), tries = { 이름: [찍은 이름…] }, santaOf = { 받는 사람: 준 사람 }
// 맞힌 사람 = 찍은 이름 가운데 자기 산타가 있음
const santaOfDraw = cards => Object.fromEntries(cards.map(c => [c.r, c.g]));
const hasGuessed = (name, tries, santaOf) => (tries[name] || []).includes(santaOf[name]);
// 다음 차례: at 다음 사람부터 한 바퀴 돌며 아직 못 맞힌 사람의 자리. 모두 맞혔으면 -1
function nextGuesser(order, at, tries, santaOf) {
  for (let k = 1; k <= order.length; k++) {
    const i = (at + k) % order.length;
    if (!hasGuessed(order[i], tries, santaOf)) return i;
  }
  return -1;
}
// 찍을 수 있는 이름: 나 말고, 내가 이미 찍은 이름 말고, 다른 사람의 산타로 이미 밝혀진 사람 말고 (선물은 한 사람이 하나씩)
function guessChoices(name, order, tries, santaOf) {
  const known = new Set(order.filter(x => x !== name && hasGuessed(x, tries, santaOf)).map(x => santaOf[x]));
  return order.filter(x => x !== name && !(tries[name] || []).includes(x) && !known.has(x));
}
// 기록 표: 맞힌 사람은 적게 찍은 순, 못 맞힌 사람은 그 아래 많이 찍은 순. 같으면 맞히는 순서대로
function guessTable(order, tries, santaOf) {
  return order.map((name, i) => ({ name, i, n: (tries[name] || []).length, ok: hasGuessed(name, tries, santaOf) }))
    .sort((a, b) => (b.ok - a.ok) || (a.ok ? a.n - b.n : b.n - a.n) || a.i - b.i)
    .map(({ name, n, ok }) => ({ name, n, ok }));
}
