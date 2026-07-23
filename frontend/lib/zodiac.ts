export interface ZodiacSign {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  luckyNumbers: [number, number, number];
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  { id: "capricorn", name: "염소자리", startMonth: 12, startDay: 22, endMonth: 1, endDay: 19, luckyNumbers: [10, 22, 40] },
  { id: "aquarius", name: "물병자리", startMonth: 1, startDay: 20, endMonth: 2, endDay: 18, luckyNumbers: [11, 29, 38] },
  { id: "pisces", name: "물고기자리", startMonth: 2, startDay: 19, endMonth: 3, endDay: 20, luckyNumbers: [7, 16, 34] },
  { id: "aries", name: "양자리", startMonth: 3, startDay: 21, endMonth: 4, endDay: 19, luckyNumbers: [9, 18, 27] },
  { id: "taurus", name: "황소자리", startMonth: 4, startDay: 20, endMonth: 5, endDay: 20, luckyNumbers: [6, 24, 33] },
  { id: "gemini", name: "쌍둥이자리", startMonth: 5, startDay: 21, endMonth: 6, endDay: 21, luckyNumbers: [5, 14, 32] },
  { id: "cancer", name: "게자리", startMonth: 6, startDay: 22, endMonth: 7, endDay: 22, luckyNumbers: [2, 20, 29] },
  { id: "leo", name: "사자자리", startMonth: 7, startDay: 23, endMonth: 8, endDay: 22, luckyNumbers: [1, 19, 37] },
  { id: "virgo", name: "처녀자리", startMonth: 8, startDay: 23, endMonth: 9, endDay: 22, luckyNumbers: [15, 23, 41] },
  { id: "libra", name: "천칭자리", startMonth: 9, startDay: 23, endMonth: 10, endDay: 22, luckyNumbers: [6, 21, 39] },
  { id: "scorpio", name: "전갈자리", startMonth: 10, startDay: 23, endMonth: 11, endDay: 21, luckyNumbers: [8, 26, 44] },
  { id: "sagittarius", name: "사수자리", startMonth: 11, startDay: 22, endMonth: 12, endDay: 21, luckyNumbers: [3, 12, 30] },
];

function isWithinRange(month: number, day: number, sign: ZodiacSign): boolean {
  const { startMonth, startDay, endMonth, endDay } = sign;
  if (startMonth === endMonth) {
    return month === startMonth && day >= startDay && day <= endDay;
  }
  if (startMonth < endMonth) {
    if (month === startMonth) return day >= startDay;
    if (month === endMonth) return day <= endDay;
    return month > startMonth && month < endMonth;
  }
  // wraps across year boundary (e.g. Capricorn: Dec 22 - Jan 19)
  if (month === startMonth) return day >= startDay;
  if (month === endMonth) return day <= endDay;
  return month > startMonth || month < endMonth;
}

export function getZodiacSign(date: Date): ZodiacSign {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const sign = ZODIAC_SIGNS.find((s) => isWithinRange(month, day, s));
  if (!sign) {
    throw new Error(`No zodiac sign matched for month=${month} day=${day}`);
  }
  return sign;
}
