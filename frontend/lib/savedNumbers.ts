const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type SavedNumberSource = "GENERATE" | "TAROT";

export interface SavedNumberResult {
  id: number;
  source: SavedNumberSource;
  targetDrawNo: number;
  numbers: number[];
  savedAt: string;
}

export async function saveNumbers(
  source: SavedNumberSource,
  numbers: number[],
  token: string
): Promise<SavedNumberResult> {
  const res = await fetch(`${API_BASE_URL}/api/saved-numbers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ source, numbers }),
  });
  if (!res.ok) {
    throw new Error("번호 저장에 실패했습니다.");
  }
  return res.json();
}

export async function getSavedNumbers(token: string): Promise<SavedNumberResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/saved-numbers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("저장된 번호를 불러오지 못했습니다.");
  }
  return res.json();
}
