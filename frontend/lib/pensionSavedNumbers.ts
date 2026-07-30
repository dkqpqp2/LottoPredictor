const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export interface PensionSavedNumberResult {
  id: number;
  targetDrawNo: number;
  groupNo: number;
  number: string;
  savedAt: string;
  resultAvailable: boolean;
  rank: string | null;
  bonusMatch: boolean | null;
  actualGroupNo: number | null;
  actualNumber: string | null;
  actualBonusNumber: string | null;
  actualDrawDate: string | null;
}

export async function getPensionSavedNumbers(token: string): Promise<PensionSavedNumberResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/pension/saved-numbers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("저장된 연금복권 번호를 불러오지 못했습니다.");
  }
  return res.json();
}
