import { describe, expect, it } from "vitest";
import { groupByRange } from "./numberRangeGroups";
import type { NumberStat } from "./api";

function stat(number: number): NumberStat {
  return { number, count: number, percentage: number };
}

describe("groupByRange", () => {
  it("splits numbers 1-45 into five 10-wide ranges with a narrower last range", () => {
    const stats = Array.from({ length: 45 }, (_, i) => stat(i + 1));

    const groups = groupByRange(stats);

    expect(groups.map((g) => g.label)).toEqual(["1-10", "11-20", "21-30", "31-40", "41-45"]);
    expect(groups.map((g) => g.items.length)).toEqual([10, 10, 10, 10, 5]);
  });

  it("places boundary numbers in the correct range", () => {
    const stats = [stat(10), stat(11), stat(40), stat(41)];

    const groups = groupByRange(stats);

    expect(groups[0].items.map((s) => s.number)).toEqual([10]);
    expect(groups[1].items.map((s) => s.number)).toEqual([11]);
    expect(groups[3].items.map((s) => s.number)).toEqual([40]);
    expect(groups[4].items.map((s) => s.number)).toEqual([41]);
  });

  it("sorts items within each range by number", () => {
    const stats = [stat(5), stat(2), stat(8)];

    const groups = groupByRange(stats);

    expect(groups[0].items.map((s) => s.number)).toEqual([2, 5, 8]);
  });

  it("returns five empty ranges for an empty input", () => {
    const groups = groupByRange([]);

    expect(groups).toHaveLength(5);
    expect(groups.every((g) => g.items.length === 0)).toBe(true);
  });
});
