const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export function getKakaoAuthorizeUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ?? "";
  const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

export interface KakaoLoginResult {
  token: string;
  nickname: string;
}

export async function loginWithKakaoCode(code: string, redirectUri: string): Promise<KakaoLoginResult> {
  const res = await fetch(`${API_BASE_URL}/api/auth/kakao/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri }),
  });
  if (!res.ok) {
    throw new Error("카카오 로그인에 실패했습니다.");
  }
  return res.json();
}

export interface MeResult {
  nickname: string;
}

export async function getMe(token: string): Promise<MeResult> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("로그인 정보를 확인하지 못했습니다.");
  }
  return res.json();
}
