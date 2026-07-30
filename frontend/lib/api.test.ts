import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateNumbers,
  generatePension,
  getPensionDraws,
  getPensionWeeklyPick,
  getPensionWeeklyPickHistory,
} from "./api";

describe("generateNumbers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the auth token as a Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: "weighted", results: [[1, 2, 3, 4, 5, 6]] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await generateNumbers("weighted", 1, "jwt-abc");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer jwt-abc");
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(generateNumbers("weighted", 1, "jwt-abc")).rejects.toThrow(
      "오늘 번호생성 사용 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요."
    );
  });

  it("throws the generic error message on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(generateNumbers("weighted", 1, "jwt-abc")).rejects.toThrow("번호 생성에 실패했습니다.");
  });
});

describe("generatePension", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the auth token as a Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ groupNo: 3, number: "011391" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await generatePension("jwt-abc");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer jwt-abc");
  });

  it("returns the generated group and number on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ groupNo: 3, number: "011391" }),
      })
    );

    const result = await generatePension("jwt-abc");

    expect(result).toEqual({ groupNo: 3, number: "011391" });
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(generatePension("jwt-abc")).rejects.toThrow("오늘 이미 사용하셨어요. 내일 다시 도전해주세요.");
  });

  it("throws the generic error message on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(generatePension("jwt-abc")).rejects.toThrow("번호 생성에 실패했습니다.");
  });
});

describe("getPensionDraws", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the draw list on success", async () => {
    const payload = [
      { drawNo: 325, drawDate: "2026-07-23", groupNo: 3, number: "011391", bonusNumber: "438906" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getPensionDraws({ page: 0, size: 1 });

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPensionDraws({ page: 0, size: 1 })).rejects.toThrow("연금복권 회차 조회에 실패했습니다.");
  });
});

describe("getPensionWeeklyPick", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the current pick on success", async () => {
    const payload = {
      weekStart: "2026-07-27",
      targetDrawNo: 326,
      groupNo: 3,
      number: "011391",
      resultAvailable: false,
      rank: null,
      bonusMatch: null,
      actualGroupNo: null,
      actualNumber: null,
      actualBonusNumber: null,
      actualDrawDate: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getPensionWeeklyPick();

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPensionWeeklyPick()).rejects.toThrow("이번 주 연금복권 추천 번호를 불러오지 못했습니다.");
  });
});

describe("getPensionWeeklyPickHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the history list on success", async () => {
    const payload = [
      {
        weekStart: "2026-07-13",
        targetDrawNo: 325,
        groupNo: 3,
        number: "011391",
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

    const result = await getPensionWeeklyPickHistory(5);

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPensionWeeklyPickHistory(5)).rejects.toThrow("연금복권 추천 이력을 불러오지 못했습니다.");
  });
});
