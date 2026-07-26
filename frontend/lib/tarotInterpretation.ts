const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type TarotInterpretationMode = "TAROT_ONLY" | "WITH_ZODIAC";

export interface TarotCardInput {
  cardNumber: number;
  nameKo: string;
  keyword: string;
  direction: "up" | "down" | "left" | "right";
  positionLabel: string | null;
}

export interface TarotInterpretationResult {
  id: number;
  mode: TarotInterpretationMode;
  cards: TarotCardInput[];
  zodiacName: string | null;
  interpretationText: string;
  createdAt: string;
}

export async function requestTarotInterpretation(
  mode: TarotInterpretationMode,
  cards: TarotCardInput[],
  zodiacName: string | null,
  token: string
): Promise<TarotInterpretationResult> {
  const res = await fetch(`${API_BASE_URL}/api/tarot/interpretation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode, cards, zodiacName }),
  });
  if (res.status === 429) {
    throw new Error("오늘 AI 해석 횟수를 다 쓰셨어요. 내일 다시 찾아와 주세요.");
  }
  if (!res.ok) {
    throw new Error("해석을 가져오지 못했어요. 다시 시도해주세요.");
  }
  return res.json();
}

export async function getTarotInterpretationHistory(token: string): Promise<TarotInterpretationResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/tarot/interpretations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("타로 해석 기록을 불러오지 못했습니다.");
  }
  return res.json();
}
