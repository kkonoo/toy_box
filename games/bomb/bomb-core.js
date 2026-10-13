'use strict';
// 폭탄 돌리기 계산 (화면 없음): bomb.js 가 쓰고, tests/bomb.test.js 가 Node에서 확인

// 시간 범위(초). 실제로 터지는 때는 그 안에서 뽑고, 화면에는 어디에도 안 보여 줌
const FUSES = {
  short: { name: '짧게', min: 10, max: 30 },
  normal: { name: '보통', min: 20, max: 60 },
  long: { name: '길게', min: 40, max: 90 },
};
// 터질 때까지 ms: min초 ~ max초 사이 고르게 (1ms 단위, crypto 난수)
const fuseMs = ({ min, max }) => min * 1000 + randInt((max - min) * 1000 + 1);
