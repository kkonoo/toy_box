'use strict';
// 제비뽑기 계산 (화면 없음): lots.js 가 쓰고, tests/lots.test.js 가 Node에서 확인
// 살림노트(everyday_notes) js/play-core.js 에서 가져옴

// n장 중 k장 당첨 (당첨이면 true)
function drawLots(n, k) {
  const win = new Set(cryptoShuffle([...Array(n).keys()]).slice(0, k));
  return Array.from({ length: n }, (_, i) => win.has(i));
}
