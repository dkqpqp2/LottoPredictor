import { afterEach, describe, expect, it, vi } from "vitest";
import { getPensionSavedNumbers } from "./pensionSavedNumbers";

describe("getPensionSavedNumbers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the saved list on success", async () => {
    const payload = [
      {
        id: 1,
        targetDrawNo: 326,
        groupNo: 3,
        number: "011391",
        savedAt: "2026-07-29T10:00:00Z",
        resultAvailable: false,
        rank: null,
        bonusMatch: null,
        actualGroupNo: null,
        actualNumber: null,
        actualBonusNumber: null,
        actualDrawDate: null,
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getPensionSavedNumbers("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("returns rank and bonus info when the target draw is resolved", async () => {
    const payload = [
      {
        id: 1,
        targetDrawNo: 325,
        groupNo: 3,
        number: "011391",
        savedAt: "2026-07-29T10:00:00Z",
        resultAvailable: true,
        rank: "1등",
        bonusMatch: false,
        actualGroupNo: 3,
        actualNumber: "011391",
        actualBonusNumber: "438906",
        actualDrawDate: "2026-07-23",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getPensionSavedNumbers("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPensionSavedNumbers("jwt-abc")).rejects.toThrow(
      "저장된 연금복권 번호를 불러오지 못했습니다."
    );
  });
});
