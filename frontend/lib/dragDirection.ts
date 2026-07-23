import type { CardDirection } from "./tarotCards";

const DEFAULT_THRESHOLD = 30;

export function detectDragDirection(dx: number, dy: number, threshold = DEFAULT_THRESHOLD): CardDirection | null {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
    return null;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}
