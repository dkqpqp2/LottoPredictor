import { afterEach, describe, expect, it, vi } from "vitest";
import { generateNumbers } from "./api";

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
