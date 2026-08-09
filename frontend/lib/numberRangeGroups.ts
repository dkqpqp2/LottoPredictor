import type { NumberStat } from "./api";

export interface NumberRangeGroup {
  label: string;
  items: NumberStat[];
}

export function groupByRange(stats: NumberStat[]): NumberRangeGroup[] {
  const byNumber = [...stats].sort((a, b) => a.number - b.number);
  const groups: NumberRangeGroup[] = [];
  for (let start = 1; start <= 41; start += 10) {
    const end = Math.min(start + 9, 45);
    groups.push({
      label: `${start}-${end}`,
      items: byNumber.filter((s) => s.number >= start && s.number <= end),
    });
  }
  return groups;
}
