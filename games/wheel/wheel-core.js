'use strict';
// 룰렛 계산 (화면 없음): wheel.js 가 쓰고, tests/wheel.test.js 가 Node에서 확인
// 살림노트(everyday_notes) js/play-core.js 에서 가져옴

// 칸 i = 위(0°)에서 시계 방향으로 i·s ~ (i+1)·s 도 (s = 360/n). 판을 시계 방향으로 rot도 돌리면 위 바늘 아래는 판의 −rot도
const sliceAt = (rot, n) => Math.floor((((-rot % 360) + 360) % 360) / (360 / n)) % n;
// 돌리기: 칸을 먼저 뽑고(index), 바늘이 그 칸 안쪽(양 끝 15%는 피해서)에 오도록 지금 각도(from)에서 turns바퀴 더 돈 각도
function spinWheel(n, from = 0, turns = 5) {
  const index = randInt(n), at = (index + 0.15 + 0.7 * randInt(1001) / 1000) * 360 / n;
  const delta = (((-at - from) % 360) + 360) % 360;
  return { index, rotation: from + turns * 360 + delta };
}
