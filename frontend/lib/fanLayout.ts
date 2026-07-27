const MAX_ANGLE_DEG = 70;
const MIN_ANGLE_DEG = 30;
const REFERENCE_WIDTH = 480;
const MIN_WIDTH = 260;
const BASE_RADIUS = 240;
const MIN_RADIUS = 130;

export interface FanTransform {
  x: number;
  y: number;
  rotate: number;
}

function clampWidth(containerWidth: number): number {
  return Math.max(MIN_WIDTH, Math.min(REFERENCE_WIDTH, containerWidth));
}

/**
 * total장을 좌우 대칭 호 모양으로 배치한다. index 0은 맨 왼쪽, index (total-1)은
 * 맨 오른쪽, 가운데 인덱스가 정점(가장 위)이고 양 끝으로 갈수록 아래로 처진다.
 * containerWidth가 좁을수록 각도/반지름이 줄어들어 좁은 화면에서도 부채가
 * 컨테이너 밖으로 넘치지 않는다.
 */
export function computeFanTransform(index: number, total: number, containerWidth: number): FanTransform {
  if (total <= 1) {
    return { x: 0, y: 0, rotate: 0 };
  }

  const clampedWidth = clampWidth(containerWidth);
  const widthFactor = (clampedWidth - MIN_WIDTH) / (REFERENCE_WIDTH - MIN_WIDTH);
  const maxAngle = MIN_ANGLE_DEG + (MAX_ANGLE_DEG - MIN_ANGLE_DEG) * widthFactor;
  const radius = MIN_RADIUS + (BASE_RADIUS - MIN_RADIUS) * widthFactor;

  const t = index / (total - 1) - 0.5;
  const angleDeg = t * maxAngle;
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: Math.sin(angleRad) * radius,
    y: radius * (1 - Math.cos(angleRad)),
    rotate: angleDeg,
  };
}
