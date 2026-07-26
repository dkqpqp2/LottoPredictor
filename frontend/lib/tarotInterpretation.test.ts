import { afterEach, describe, expect, it, vi } from "vitest";
import { requestTarotInterpretation, getTarotInterpretationHistory } from "./tarotInterpretation";

describe("requestTarotInterpretation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the interpretation on success", async () => {
    const payload = {
      id: 1,
      mode: "WITH_ZODIAC",
      cards: [{ cardNumber: 0, nameKo: "바보", keyword: "새로운 시작", direction: "up", positionLabel: null }],
      zodiacName: "물병자리",
      interpretationText: "따뜻한 해석 텍스트",
      createdAt: "2026-07-26T10:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await requestTarotInterpretation(
      "WITH_ZODIAC",
      [{ cardNumber: 0, nameKo: "바보", keyword: "새로운 시작", direction: "up", positionLabel: null }],
      "물병자리",
      "jwt-abc"
    );

    expect(result).toEqual(payload);
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(
      requestTarotInterpretation("TAROT_ONLY", [], null, "jwt-abc")
    ).rejects.toThrow("오늘 AI 해석 횟수를 다 쓰셨어요. 내일 다시 찾아와 주세요.");
  });

  it("throws a generic message on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));

    await expect(
      requestTarotInterpretation("TAROT_ONLY", [], null, "jwt-abc")
    ).rejects.toThrow("해석을 가져오지 못했어요. 다시 시도해주세요.");
  });
});

describe("getTarotInterpretationHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the history list on success", async () => {
    const payload = [
      {
        id: 1,
        mode: "TAROT_ONLY",
        cards: [{ cardNumber: 0, nameKo: "바보", keyword: "새로운 시작", direction: "up", positionLabel: "과거" }],
        zodiacName: null,
        interpretationText: "해석문",
        createdAt: "2026-07-26T10:00:00Z",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getTarotInterpretationHistory("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getTarotInterpretationHistory("jwt-abc")).rejects.toThrow(
      "타로 해석 기록을 불러오지 못했습니다."
    );
  });
});
