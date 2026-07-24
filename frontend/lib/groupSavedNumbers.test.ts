import { describe, expect, it } from "vitest";
import { groupSavedNumbers } from "./groupSavedNumbers";
import type { SavedNumberResult } from "./savedNumbers";

function item(savedAt: string, id = 1): SavedNumberResult {
  return { id, source: "GENERATE", targetDrawNo: 1181, numbers: [1, 2, 3, 4, 5, 6], savedAt };
}

describe("groupSavedNumbers", () => {
  it("returns an empty array for no saved numbers", () => {
    expect(groupSavedNumbers([])).toEqual([]);
  });

  it("groups items saved in the same week under one week entry", () => {
    const groups = groupSavedNumbers([
      item("2026-07-06T12:00:00", 1),
      item("2026-07-08T12:00:00", 2),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].weeks).toHaveLength(1);
    expect(groups[0].weeks[0].items).toHaveLength(2);
  });

  it("splits items saved in different weeks of the same month", () => {
    const groups = groupSavedNumbers([
      item("2026-07-06T12:00:00", 1),
      item("2026-07-13T12:00:00", 2),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].weeks).toHaveLength(2);
  });

  it("splits items saved in different months and orders the most recent month first", () => {
    const groups = groupSavedNumbers([
      item("2026-06-15T12:00:00", 1),
      item("2026-07-06T12:00:00", 2),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].monthLabel).toBe("2026년 7월");
    expect(groups[1].monthLabel).toBe("2026년 6월");
  });

  it("orders weeks within a month most recent first", () => {
    const groups = groupSavedNumbers([
      item("2026-07-06T12:00:00", 1),
      item("2026-07-13T12:00:00", 2),
    ]);

    expect(groups[0].weeks[0].weekStart).toBe("2026-07-13");
    expect(groups[0].weeks[1].weekStart).toBe("2026-07-06");
  });
});
