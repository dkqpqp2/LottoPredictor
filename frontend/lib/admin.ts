const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export interface AdminUser {
  id: number;
  nickname: string;
  tier: string;
  totalPoints: number;
  forcedTier: string | null;
  joinedAt: string;
}

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) {
    throw new Error("관리자 계정만 이용할 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("회원 목록을 불러오지 못했습니다.");
  }
  return res.json();
}

export async function setUserTier(userId: number, tier: string | null, token: string): Promise<AdminUser> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/tier`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tier }),
  });
  if (res.status === 403) {
    throw new Error("관리자 계정만 이용할 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("등급 변경에 실패했습니다.");
  }
  return res.json();
}
