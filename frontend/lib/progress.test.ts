import { afterEach, describe, expect, it, vi } from "vitest";
import { getProgress, consumeTarotUsage } from "./progress";

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

describe("consumeTarotUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the updated progress on success", async () => {
    const payload = {
      tier: "초심자",
      totalPoints: 4,
      pointsToNextTier: 46,
      tarotUsage: { used: 1, limit: 1 },
      generateUsage: { used: 0, limit: 1 },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await consumeTarotUsage("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(consumeTarotUsage("jwt-abc")).rejects.toThrow(
      "오늘 타로 사용 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요."
    );
  });

  it("throws a generic message on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(consumeTarotUsage("jwt-abc")).rejects.toThrow("타로 사용 처리에 실패했습니다.");
  });
});
