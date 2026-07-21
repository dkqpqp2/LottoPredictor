// 동행복권 공식 로또 6/45 번호 구간별 색상.
export function getBallColor(n: number): string {
  if (n <= 10) return "#fbc400";
  if (n <= 20) return "#69c8f2";
  if (n <= 30) return "#ff7272";
  if (n <= 40) return "#aaaaaa";
  return "#b0d840";
}
