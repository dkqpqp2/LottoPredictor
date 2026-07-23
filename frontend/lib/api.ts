const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type GenerateMode = "weighted" | "random";

export interface GenerateResult {
  mode: GenerateMode;
  results: number[][];
}

export async function generateNumbers(mode: GenerateMode, sets: number): Promise<GenerateResult> {
  const res = await fetch(`${API_BASE_URL}/api/generate?mode=${mode}&sets=${sets}`);
  if (!res.ok) {
    throw new Error("번호 생성에 실패했습니다.");
  }
  return res.json();
}

export interface NumberStat {
  number: number;
  count: number;
  percentage: number;
}

export async function getStats(): Promise<NumberStat[]> {
  const res = await fetch(`${API_BASE_URL}/api/stats`);
  if (!res.ok) {
    throw new Error("통계를 불러오지 못했습니다.");
  }
  return res.json();
}

export interface DuplicateDrawGroup {
  numbers: number[];
  drawNos: number[];
}

export async function getDuplicateDraws(): Promise<DuplicateDrawGroup[]> {
  const res = await fetch(`${API_BASE_URL}/api/duplicate-draws`);
  if (!res.ok) {
    throw new Error("중복 번호 조합을 불러오지 못했습니다.");
  }
  return res.json();
}

export interface DrawResponse {
  drawNo: number;
  drawDate: string;
  numbers: number[];
  bonusNum: number;
}

export interface GetDrawsParams {
  drawNo?: number;
  date?: string;
  page?: number;
  size?: number;
}

export async function getDraws(params: GetDrawsParams): Promise<DrawResponse[]> {
  const search = new URLSearchParams();
  if (params.drawNo != null) search.set("drawNo", String(params.drawNo));
  if (params.date) search.set("date", params.date);
  if (params.page != null) search.set("page", String(params.page));
  if (params.size != null) search.set("size", String(params.size));

  const res = await fetch(`${API_BASE_URL}/api/draws?${search.toString()}`);
  if (!res.ok) {
    throw new Error("회차 조회에 실패했습니다.");
  }
  return res.json();
}

export interface SkippedDraw {
  drawNo: number;
  reason: string;
}

export interface SyncResult {
  synced: number[];
  skipped: SkippedDraw[];
}

export async function triggerCrawl(secret: string): Promise<SyncResult> {
  const res = await fetch(`${API_BASE_URL}/api/crawl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (res.status === 401) {
    throw new Error("시크릿이 올바르지 않습니다.");
  }
  if (!res.ok) {
    throw new Error("크롤링 요청에 실패했습니다.");
  }
  return res.json();
}

export interface WeeklyPickResult {
  weekStart: string;
  targetDrawNo: number;
  numbers: number[];
  resultAvailable: boolean;
  matchCount: number | null;
  bonusMatch: boolean | null;
  rank: string | null;
  actualNumbers: number[] | null;
  actualBonus: number | null;
  actualDrawDate: string | null;
}

export async function getWeeklyPick(): Promise<WeeklyPickResult> {
  const res = await fetch(`${API_BASE_URL}/api/weekly-pick`);
  if (!res.ok) {
    throw new Error("이번 주 추천 번호를 불러오지 못했습니다.");
  }
  return res.json();
}

export async function getWeeklyPickHistory(limit = 5): Promise<WeeklyPickResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/weekly-pick/history?limit=${limit}`);
  if (!res.ok) {
    throw new Error("추천 이력을 불러오지 못했습니다.");
  }
  return res.json();
}
