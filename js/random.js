'use strict';
// 난수 (화면 없음): 모든 게임이 crypto.getRandomValues로 결과를 먼저 정하고, 화면은 그 결과대로 움직이기만 함
// 살림노트(everyday_notes) js/play-core.js 에서 가져옴

// 0 이상 max 미만 정수, 고르게 (2^32를 max로 나눈 나머지 구간은 버리고 다시 → 앞쪽 숫자가 더 나오지 않게)
function randInt(max) {
  const lim = Math.floor(0x100000000 / max) * max, a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return a[0] % max;
}
// 순서 섞기 (Fisher–Yates). 원래 배열은 그대로
function cryptoShuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
