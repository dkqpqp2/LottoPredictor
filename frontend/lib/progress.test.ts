import { afterEach, describe, expect, it, vi } from "vitest";
import { getProgress, consumeGenerateUsage, formatRemainingUsage } from "./progress";

describe("formatRemainingUsage", () => {
  it("shows a used/limit fraction for a normal limit", () => {
    expect(formatRemainingUsage({ used: 1, limit: 3 })).toBe("2/3");
  });

  it("shows 무제한 when the limit is the unlimited sentinel", () => {
    expect(formatRemainingUsage({ used: 1, limit: 2147483647 })).toBe("무제한");
  });
});

describe("getProgress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the progress payload on success", async () => {
    const payload = {
      tier: "초심자",
      totalPoints: 3,
      pointsToNextTier: 47,
      tarotUsage: { used: 0, limit: 1 },
      generateUsage: { used: 0, limit: 1 },
      maxSets: 2,
      adjustableSets: false,
      tierFloor: 0,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getProgress("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getProgress("jwt-abc")).rejects.toThrow("등급 정보를 불러오지 못했습니다.");
  });
});

describe("consumeGenerateUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the updated progress on success", async () => {
    const payload = {
      tier: "초심자",
      totalPoints: 4,
      pointsToNextTier: 46,
      tarotUsage: { used: 0, limit: 1 },
      generateUsage: { used: 1, limit: 3 },
      maxSets: 3,
      adjustableSets: false,
      tierFloor: 0,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await consumeGenerateUsage("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(consumeGenerateUsage("jwt-abc")).rejects.toThrow(
      "오늘 번호생성 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요."
    );
  });

  it("throws a generic message on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(consumeGenerateUsage("jwt-abc")).rejects.toThrow("번호생성 처리에 실패했습니다.");
  });
});
