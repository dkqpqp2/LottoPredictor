import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getKakaoAuthorizeUrl, loginWithKakaoCode, getMe } from "./auth";

describe("getKakaoAuthorizeUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_REDIRECT_URI", "http://localhost:3000/auth/kakao/callback");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the kakao authorize url with client id and redirect uri", () => {
    const url = getKakaoAuthorizeUrl();
    expect(url).toContain("https://kauth.kakao.com/oauth/authorize?");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("redirect_uri=" + encodeURIComponent("http://localhost:3000/auth/kakao/callback"));
    expect(url).toContain("response_type=code");
  });
});

describe("loginWithKakaoCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the token and nickname on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "jwt-abc", nickname: "홍길동" }),
      })
    );

    const result = await loginWithKakaoCode("auth-code", "http://localhost:3000/auth/kakao/callback");

    expect(result).toEqual({ token: "jwt-abc", nickname: "홍길동" });
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(
      loginWithKakaoCode("bad-code", "http://localhost:3000/auth/kakao/callback")
    ).rejects.toThrow("카카오 로그인에 실패했습니다.");
  });
});

describe("getMe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the nickname when the token is valid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nickname: "홍길동" }) }));

    const result = await getMe("jwt-abc");

    expect(result).toEqual({ nickname: "홍길동" });
  });

  it("throws when the token is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(getMe("bad-token")).rejects.toThrow("로그인 정보를 확인하지 못했습니다.");
  });
});
