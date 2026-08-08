# /generate 페이지 번호 분석 섹션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/generate` 페이지에 출현 빈도 상위 랭킹 + 번호 구간 분포를 보여주는 "N회 번호 분석" 섹션을 추가한다.

**Architecture:** 백엔드 변경 없이 기존 `GET /api/stats`를 재사용한다. `/stats` 페이지에만 있던 "번호를 5개 구간으로 나누기" 로직을 `frontend/lib/numberRangeGroups.ts`라는 공용 함수로 분리해서 두 페이지가 같이 쓰고, `/generate`는 그 결과를 구간별 합계 막대로 압축해서 보여준다. 새 차트는 `/stats`가 이미 쓰는 CSS 퍼센트-너비 막대 패턴을 재사용한다 (차트 라이브러리 없음).

**Tech Stack:** Next.js 16 App Router + TypeScript, Vitest.

## Global Constraints

- 백엔드/DB 변경 없음 — 기존 `GET /api/stats`(`NumberStat[]`, 역대 전체 회차 기준)만 사용한다.
- 새 차트 라이브러리를 추가하지 않는다 — `/stats` 페이지가 이미 쓰는 "트랙 `<span>` + 퍼센트 너비 내부 `<span>`" CSS 막대 패턴을 그대로 재사용한다.
- `groupByRange()`는 "번호를 5개 구간(1-10/11-20/21-30/31-40/41-45)으로 나누고 각 구간에 속한 `NumberStat` 항목을 그대로 담는" 역할만 한다 — 구간별 합계 계산은 이 함수에 넣지 않고 호출하는 쪽(`/generate`)에서 한다. `/stats`는 이 함수가 반환하는 `items`를 그대로 순회해서 개별 번호 막대를 그리므로, 함수 시그니처를 `{ label, totalCount }`가 아니라 `{ label, items: NumberStat[] }`로 유지해야 `/stats`의 기존 동작이 깨지지 않는다.
- `/stats` 페이지의 화면 표시는 리팩터 전후로 동일해야 한다 (계산 로직 위치만 옮기는 것이지 동작을 바꾸는 게 아님).
- `/generate` 페이지의 새 섹션은 `stats`와 `weeklyPick`이 둘 다 로드된 뒤에만 보인다 (제목에 `weeklyPick.targetDrawNo`를 재사용하므로). `getStats()` 실패 시 섹션 전체가 조용히 안 보인다 (에러 메시지 없음, 기존 `latestCard`/`weeklyCard`/`historyCard`와 동일한 패턴).
- `frontend/lib/numberRangeGroups.ts`는 전용 테스트를 작성한다. `/stats`/`/generate` 페이지 자체는 이 코드베이스 컨벤션상 전용 테스트가 없다 — 타입체크 + 브라우저 확인으로 검증한다.

---

### Task 1: `frontend/lib/numberRangeGroups.ts` (구간 나누기 공용 함수)

**Files:**
- Create: `frontend/lib/numberRangeGroups.ts`
- Test: `frontend/lib/numberRangeGroups.test.ts`

**Interfaces:**
- Consumes: 기존 `NumberStat` 타입(`frontend/lib/api.ts`, `{ number: number; count: number; percentage: number }`)
- Produces: `NumberRangeGroup { label: string; items: NumberStat[] }`, `groupByRange(stats: NumberStat[]): NumberRangeGroup[]`. Task 2(`/stats` 리팩터)와 Task 3(`/generate` 신규 섹션)이 이 함수를 그대로 사용한다.

이 태스크는 다른 태스크와 독립적이다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/numberRangeGroups.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupByRange } from "./numberRangeGroups";
import type { NumberStat } from "./api";

function stat(number: number): NumberStat {
  return { number, count: number, percentage: number };
}

describe("groupByRange", () => {
  it("splits numbers 1-45 into five 10-wide ranges with a narrower last range", () => {
    const stats = Array.from({ length: 45 }, (_, i) => stat(i + 1));

    const groups = groupByRange(stats);

    expect(groups.map((g) => g.label)).toEqual(["1-10", "11-20", "21-30", "31-40", "41-45"]);
    expect(groups.map((g) => g.items.length)).toEqual([10, 10, 10, 10, 5]);
  });

  it("places boundary numbers in the correct range", () => {
    const stats = [stat(10), stat(11), stat(40), stat(41)];

    const groups = groupByRange(stats);

    expect(groups[0].items.map((s) => s.number)).toEqual([10]);
    expect(groups[1].items.map((s) => s.number)).toEqual([11]);
    expect(groups[3].items.map((s) => s.number)).toEqual([40]);
    expect(groups[4].items.map((s) => s.number)).toEqual([41]);
  });

  it("sorts items within each range by number", () => {
    const stats = [stat(5), stat(2), stat(8)];

    const groups = groupByRange(stats);

    expect(groups[0].items.map((s) => s.number)).toEqual([2, 5, 8]);
  });

  it("returns five empty ranges for an empty input", () => {
    const groups = groupByRange([]);

    expect(groups).toHaveLength(5);
    expect(groups.every((g) => g.items.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/numberRangeGroups.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음 (`./numberRangeGroups`가 아직 없음)

- [ ] **Step 3: `numberRangeGroups.ts` 작성**

`frontend/lib/numberRangeGroups.ts`:

```ts
import type { NumberStat } from "./api";

export interface NumberRangeGroup {
  label: string;
  items: NumberStat[];
}

export function groupByRange(stats: NumberStat[]): NumberRangeGroup[] {
  const byNumber = [...stats].sort((a, b) => a.number - b.number);
  const groups: NumberRangeGroup[] = [];
  for (let start = 1; start <= 41; start += 10) {
    const end = Math.min(start + 9, 45);
    groups.push({
      label: `${start}-${end}`,
      items: byNumber.filter((s) => s.number >= start && s.number <= end),
    });
  }
  return groups;
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/numberRangeGroups.test.ts`
Expected: 4개 테스트 전부 통과

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/numberRangeGroups.ts frontend/lib/numberRangeGroups.test.ts
git commit -m "Add groupByRange for splitting number stats into 5 ranges"
```

---

### Task 2: `/stats` 페이지가 `groupByRange()`를 쓰도록 리팩터

**Files:**
- Modify: `frontend/app/stats/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `groupByRange(stats: NumberStat[]): NumberRangeGroup[]`
- Produces: 없음

이 태스크는 Task 1에 의존한다. `/stats` 페이지는 이 코드베이스 컨벤션상 전용 테스트가 없다 — 타입체크 + 브라우저 확인(리팩터 전후 화면이 동일한지)으로 검증한다.

- [ ] **Step 1: import 추가**

`frontend/app/stats/page.tsx`의 다음 줄:

```tsx
import { getDuplicateDraws, getStats, type DuplicateDrawGroup, type NumberStat } from "../../lib/api";
import { getBallColor } from "../../lib/lottoBall";
```

를 다음으로 교체:

```tsx
import { getDuplicateDraws, getStats, type DuplicateDrawGroup, type NumberStat } from "../../lib/api";
import { getBallColor } from "../../lib/lottoBall";
import { groupByRange } from "../../lib/numberRangeGroups";
```

- [ ] **Step 2: 인라인 `rangeGroups` 계산을 `groupByRange()` 호출로 교체**

다음 블록:

```tsx
  const rangeGroups = useMemo(() => {
    if (!stats) return [];
    const byNumber = [...stats].sort((a, b) => a.number - b.number);
    const groups: { label: string; items: NumberStat[] }[] = [];
    for (let start = 1; start <= 41; start += 10) {
      const end = Math.min(start + 9, 45);
      groups.push({
        label: `${start}-${end}`,
        items: byNumber.filter((s) => s.number >= start && s.number <= end),
      });
    }
    return groups;
  }, [stats]);
```

를 다음으로 교체:

```tsx
  const rangeGroups = useMemo(() => (stats ? groupByRange(stats) : []), [stats]);
```

- [ ] **Step 3: 타입체크 + 전체 테스트 확인**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 통과

- [ ] **Step 4: 브라우저에서 리팩터 전후 화면이 동일한지 확인**

`/stats` 페이지를 열어서 "번호순" 탭(구간별 5열 그리드)이 리팩터 전과 똑같이 보이는지 확인한다 — 각 구간(1-10, 11-20, ...)에 속한 번호와 막대 길이가 그대로여야 한다.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/stats/page.tsx
git commit -m "Reuse groupByRange in the stats page instead of an inline calculation"
```

---

### Task 3: `/generate` 페이지에 "N회 번호 분석" 섹션 추가

**Files:**
- Modify: `frontend/app/generate/page.tsx`
- Modify: `frontend/app/generate/generate.module.css`

**Interfaces:**
- Consumes: Task 1의 `groupByRange(stats: NumberStat[]): NumberRangeGroup[]`, 기존 `getStats(): Promise<NumberStat[]>`(`frontend/lib/api.ts`), 기존 `getBallColor()`(`frontend/lib/lottoBall.ts`)
- Produces: 없음 (이 플랜의 마지막 태스크)

이 태스크는 Task 1에 의존한다 (Task 2와는 독립적 — 둘 다 Task 1만 필요로 함). `/generate` 페이지는 이 코드베이스 컨벤션상 전용 테스트가 없다 — 타입체크 + 브라우저 확인으로 검증한다.

- [ ] **Step 1: import 및 state 추가**

`frontend/app/generate/page.tsx`의 다음 블록:

```tsx
import {
  generateNumbers,
  getDraws,
  getWeeklyPick,
  getWeeklyPickHistory,
  type DrawResponse,
  type GenerateMode,
  type GenerateResult,
  type WeeklyPickResult,
} from "../../lib/api";
import { getBallColor } from "../../lib/lottoBall";
```

를 다음으로 교체:

```tsx
import {
  generateNumbers,
  getDraws,
  getStats,
  getWeeklyPick,
  getWeeklyPickHistory,
  type DrawResponse,
  type GenerateMode,
  type GenerateResult,
  type NumberStat,
  type WeeklyPickResult,
} from "../../lib/api";
import { getBallColor } from "../../lib/lottoBall";
import { groupByRange } from "../../lib/numberRangeGroups";
```

`const [weeklyHistory, setWeeklyHistory] = useState<WeeklyPickResult[]>([]);` 바로 아래에 추가:

```tsx
  const [stats, setStats] = useState<NumberStat[] | null>(null);
```

- [ ] **Step 2: 마운트 시 데이터 fetch에 `getStats()` 추가**

기존 `useEffect` 블록:

```tsx
  useEffect(() => {
    getDraws({ page: 0, size: 1 })
      .then((draws) => setLatestDraw(draws[0] ?? null))
      .catch(() => setLatestDraw(null));
    getWeeklyPick()
      .then(setWeeklyPick)
      .catch(() => setWeeklyPick(null));
    getWeeklyPickHistory(5)
      .then(setWeeklyHistory)
      .catch(() => setWeeklyHistory([]));
  }, []);
```

를 다음으로 교체:

```tsx
  useEffect(() => {
    getDraws({ page: 0, size: 1 })
      .then((draws) => setLatestDraw(draws[0] ?? null))
      .catch(() => setLatestDraw(null));
    getWeeklyPick()
      .then(setWeeklyPick)
      .catch(() => setWeeklyPick(null));
    getWeeklyPickHistory(5)
      .then(setWeeklyHistory)
      .catch(() => setWeeklyHistory([]));
    getStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);
```

- [ ] **Step 3: 분석용 파생 데이터 계산 추가**

`handleSave` 함수가 끝나는 지점(`return (` 바로 위)에 추가:

```tsx
  const topStats = stats ? [...stats].sort((a, b) => b.count - a.count).slice(0, 8) : [];
  const maxTopCount = topStats.length > 0 ? Math.max(...topStats.map((s) => s.count)) : 1;

  const rangeTotals = stats
    ? groupByRange(stats).map((g) => ({
        label: g.label,
        total: g.items.reduce((sum, s) => sum + s.count, 0),
      }))
    : [];
  const maxRangeTotal = rangeTotals.length > 0 ? Math.max(...rangeTotals.map((r) => r.total)) : 1;

```

- [ ] **Step 4: 분석 섹션 렌더링 추가**

다음 블록(이번주 추천 카드가 끝나는 지점부터 지난 이력 카드가 시작되는 지점까지):

```tsx
          ) : (
            <p className={styles.weeklyPending}>{weeklyPick.targetDrawNo}회 추첨 결과를 기다리는 중입니다.</p>
          )}
        </div>
      )}

      {weeklyHistory.length > 0 && (
```

를 다음으로 교체:

```tsx
          ) : (
            <p className={styles.weeklyPending}>{weeklyPick.targetDrawNo}회 추첨 결과를 기다리는 중입니다.</p>
          )}
        </div>
      )}

      {stats && weeklyPick && (
        <div className={styles.analysisCard}>
          <span className={styles.weeklyTitle}>{weeklyPick.targetDrawNo}회 번호 분석</span>

          <div className={styles.analysisGroup}>
            <span className={styles.analysisGroupTitle}>출현 빈도 상위 8개</span>
            <div className={styles.analysisList}>
              {topStats.map((s) => (
                <div key={s.number} className={styles.analysisRow}>
                  <span className={styles.analysisBadge} style={{ backgroundColor: getBallColor(s.number) }}>
                    {s.number}
                  </span>
                  <span className={styles.analysisBarTrack}>
                    <span
                      className={styles.analysisBarFill}
                      style={{ width: `${(s.count / maxTopCount) * 100}%` }}
                    />
                  </span>
                  <span className={styles.analysisCount}>{s.count}회</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.analysisGroup}>
            <span className={styles.analysisGroupTitle}>번호 구간 분포</span>
            <div className={styles.analysisList}>
              {rangeTotals.map((r) => (
                <div key={r.label} className={styles.analysisRow}>
                  <span className={styles.analysisRangeLabel}>{r.label}</span>
                  <span className={styles.analysisBarTrack}>
                    <span
                      className={styles.analysisBarFill}
                      style={{ width: `${(r.total / maxRangeTotal) * 100}%` }}
                    />
                  </span>
                  <span className={styles.analysisCount}>{r.total}회</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {weeklyHistory.length > 0 && (
```

- [ ] **Step 5: CSS 클래스 추가**

`frontend/app/generate/generate.module.css` 맨 끝에 추가:

```css
.analysisCard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.analysisGroup {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.analysisGroupTitle {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.analysisList {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.analysisRow {
  display: grid;
  grid-template-columns: 2.2rem 1fr 3rem;
  align-items: center;
  gap: 0.6rem;
}

.analysisBadge {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
}

.analysisRangeLabel {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.analysisBarTrack {
  background: var(--surface-hover);
  border-radius: 999px;
  height: 0.5rem;
  overflow: hidden;
}

.analysisBarFill {
  display: block;
  background: var(--accent);
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.analysisCount {
  text-align: right;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: 타입체크 + 전체 테스트 확인**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 통과

- [ ] **Step 7: 브라우저에서 확인**

`/generate` 페이지를 열어서 이번주 추천 카드 아래에 "N회 번호 분석" 섹션이 뜨는지, 출현 빈도 상위 8개와 번호 구간 분포 막대가 정상적으로 그려지는지 확인한다. `stats` 또는 `weeklyPick` fetch가 실패해도(예: 백엔드 미기동) 이 섹션이 조용히 안 보이는지도 확인한다.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/generate/page.tsx frontend/app/generate/generate.module.css
git commit -m "Add frequency and range-distribution analysis section to /generate"
```

---

## 배포 참고사항 (이 플랜 밖의 수동 작업)

없음 — 프론트엔드 전용 변경, 백엔드/DB 마이그레이션 없음.

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서의 공용 함수(Task 1), `/stats` 리팩터(Task 2), `/generate` 신규 섹션(Task 3) 전부 태스크로 반영됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 없음 — 전 스텝에 실제 코드/명령어 포함.
- **타입 일관성:** `NumberRangeGroup { label, items: NumberStat[] }`(Task 1에서 정의)를 Task 2(`/stats` 리팩터)와 Task 3(`/generate`의 `rangeTotals` 계산)이 정확히 같은 형태로 소비함을 확인함 — `items`를 그대로 순회(`/stats`)하는 경우와 `items.reduce`로 합산(`/generate`)하는 경우 둘 다 `NumberRangeGroup.items: NumberStat[]` 하나의 계약으로 충족됨.
- **기존 코드 영향 범위 확인:** `/stats` 페이지의 `rangeGroups` 계산 결과 타입(`{ label, items }[]`)이 리팩터 전후로 동일해서, 그 아래 JSX(`rangeGroups.map(...)` → `group.items.map(...)`)는 전혀 수정할 필요가 없었음 — Task 2는 계산부만 교체하고 렌더링 부분은 그대로 둠. `/generate`의 기존 `latestCard`/`weeklyCard`/`historyCard`, 뽑기 버튼/애니메이션/저장 로직은 Task 3에서 전혀 수정하지 않고 그 사이에 새 섹션만 삽입함.
