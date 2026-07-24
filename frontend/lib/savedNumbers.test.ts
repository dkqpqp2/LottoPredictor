import { afterEach, describe, expect, it, vi } from "vitest";
import { saveNumbers, getSavedNumbers } from "./savedNumbers";

describe("saveNumbers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the saved record on success", async () => {
    const payload = {
      id: 1,
      source: "GENERATE",
      targetDrawNo: 1181,
      numbers: [1, 2, 3, 4, 5, 6],
      savedAt: "2026-07-24T10:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await saveNumbers("GENERATE", [1, 2, 3, 4, 5, 6], "jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(saveNumbers("TAROT", [1, 2, 3, 4, 5, 6], "jwt-abc")).rejects.toThrow(
      "번호 저장에 실패했습니다."
    );
  });
});

describe("getSavedNumbers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the saved list on success", async () => {
    const payload = [
      {
        id: 1,
        source: "GENERATE",
        targetDrawNo: 1181,
        numbers: [1, 2, 3, 4, 5, 6],
        savedAt: "2026-07-24T10:00:00Z",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getSavedNumbers("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getSavedNumbers("jwt-abc")).rejects.toThrow("저장된 번호를 불러오지 못했습니다.");
  });
});
