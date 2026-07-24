import type { SavedNumberResult } from "./savedNumbers";

export interface WeekGroup {
  weekStart: string;
  items: SavedNumberResult[];
}

export interface MonthGroup {
  monthLabel: string;
  weeks: WeekGroup[];
}

function mondayStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

export function groupSavedNumbers(items: SavedNumberResult[]): MonthGroup[] {
  const monthMap = new Map<string, Map<string, SavedNumberResult[]>>();

  for (const item of items) {
    const date = new Date(item.savedAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const weekKey = mondayStart(date);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, new Map());
    }
    const weekMap = monthMap.get(monthKey)!;
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(item);
  }

  const sortedMonthKeys = [...monthMap.keys()].sort().reverse();
  return sortedMonthKeys.map((monthKey) => {
    const [year, month] = monthKey.split("-");
    const weekMap = monthMap.get(monthKey)!;
    const sortedWeekKeys = [...weekMap.keys()].sort().reverse();
    return {
      monthLabel: `${year}년 ${Number(month)}월`,
      weeks: sortedWeekKeys.map((weekStart) => ({
        weekStart,
        items: weekMap.get(weekStart)!,
      })),
    };
  });
}
