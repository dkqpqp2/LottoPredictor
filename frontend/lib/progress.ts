const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export interface ProgressResult {
  tier: string;
  totalPoints: number;
  pointsToNextTier: number | null;
  tarotUsage: { used: number; limit: number };
  generateUsage: { used: number; limit: number };
}

export async function getProgress(token: string): Promise<ProgressResult> {
  const res = await fetch(`${API_BASE_URL}/api/progress/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("등급 정보를 불러오지 못했습니다.");
  }
  return res.json();
}

export async function consumeTarotUsage(token: string): Promise<ProgressResult> {
  const res = await fetch(`${API_BASE_URL}/api/progress/tarot-usage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    throw new Error("오늘 타로 사용 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("타로 사용 처리에 실패했습니다.");
  }
  return res.json();
}
