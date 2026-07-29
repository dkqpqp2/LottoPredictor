# 연금복권720+ 프론트 뽑기 화면 (3단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연금복권720+ 번호를 뽑을 수 있는 프론트엔드 페이지 `/pension`을 추가한다 (슬롯머신 스타일 연출 포함).

**Architecture:** `lib/api.ts`에 `GET /api/pension/generate`를 호출하는 함수를, `lib/progress.ts`의 `ProgressResult`에 `pensionUsage` 필드를 추가한다. 새 `PensionDrawAnimation` 컴포넌트가 조 1자리 + 숫자 6자리, 총 7개의 "릴"을 각각 빠르게 순환시키다가 순서대로 멈추는 연출을 담당한다. 새 `/pension` 페이지가 기존 `/generate`와 같은 구조(히어로, 로그인 게이트, 카드)로 이 둘을 엮는다. `Nav`/`sitemap`에 새 페이지를 반영한다.

**Tech Stack:** Next.js 16 App Router (TypeScript, CSS Modules), Vitest.

## Global Constraints

- 연금복권 결과는 조 1~5 + 6자리 번호이며, "세트" 개념이 없다 — 항상 정확히 1개만 뽑는다.
- 소진 상태(오늘 이미 사용함) UI는 타로 모드 선택 화면과 같은 문구 패턴을 쓴다: 버튼 비활성화 + "내일 다시 시도해주세요".
- 뽑은 번호 저장/마이페이지 연동은 이번 범위 밖이다 (4단계) — 결과는 세션 동안만 화면에 표시되고 별도로 저장하지 않는다.
- 페이지/애니메이션 컴포넌트는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 (기존 `LottoDrawAnimation`도 동일) — 타입체크 + 브라우저 수동 확인으로 검증한다. `lib/api.ts`/`lib/progress.ts`의 순수 함수/타입 변경은 유닛 테스트를 작성한다 (기존 `api.test.ts`/`progress.test.ts` 컨벤션).

---

### Task 1: `lib/api.ts`에 `generatePension` 추가, `lib/progress.ts`에 `pensionUsage` 추가

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/progress.ts`
- Test: `frontend/lib/api.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `PensionGenerateResult { groupNo: number; number: string }`, `generatePension(token: string): Promise<PensionGenerateResult>`. `ProgressResult.pensionUsage: { used: number; limit: number }`. Task 3(`/pension` 페이지)이 이 타입/함수를 그대로 사용한다.

이 태스크는 다른 태스크와 독립적이다.

- [ ] **Step 1: `api.test.ts` import 교체 + 실패하는 테스트 작성**

`frontend/lib/api.test.ts`의 2번째 줄:

```ts
import { generateNumbers } from "./api";
```

를 다음으로 교체:

```ts
import { generateNumbers, generatePension } from "./api";
```

파일 맨 끝에 새 `describe` 블록 추가:

```ts
describe("generatePension", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the auth token as a Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ groupNo: 3, number: "011391" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await generatePension("jwt-abc");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer jwt-abc");
  });

  it("returns the generated group and number on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ groupNo: 3, number: "011391" }),
      })
    );

    const result = await generatePension("jwt-abc");

    expect(result).toEqual({ groupNo: 3, number: "011391" });
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(generatePension("jwt-abc")).rejects.toThrow("오늘 이미 사용하셨어요. 내일 다시 도전해주세요.");
  });

  it("throws the generic error message on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(generatePension("jwt-abc")).rejects.toThrow("번호 생성에 실패했습니다.");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/api.test.ts`
Expected: FAIL — `generatePension`이 아직 존재하지 않음 (컴파일/임포트 에러)

- [ ] **Step 3: `generatePension` 구현 작성**

`frontend/lib/api.ts`에서 기존 `triggerPensionCrawl` 함수(102-114번째 줄) 바로 뒤에 추가:

```ts
export interface PensionGenerateResult {
  groupNo: number;
  number: string;
}

export async function generatePension(token: string): Promise<PensionGenerateResult> {
  const res = await fetch(`${API_BASE_URL}/api/pension/generate`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    throw new Error("오늘 이미 사용하셨어요. 내일 다시 도전해주세요.");
  }
  if (!res.ok) {
    throw new Error("번호 생성에 실패했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/api.test.ts`
Expected: 전부 통과

- [ ] **Step 5: `lib/progress.ts`에 `pensionUsage` 필드 추가**

`frontend/lib/progress.ts`에서:

```ts
export interface ProgressResult {
  tier: string;
  totalPoints: number;
  pointsToNextTier: number | null;
  tarotUsage: { used: number; limit: number };
  generateUsage: { used: number; limit: number };
  maxSets: number;
  adjustableSets: boolean;
  tierFloor: number;
}
```

를 다음으로 교체 (`generateUsage`와 `maxSets` 사이에 `pensionUsage` 추가):

```ts
export interface ProgressResult {
  tier: string;
  totalPoints: number;
  pointsToNextTier: number | null;
  tarotUsage: { used: number; limit: number };
  generateUsage: { used: number; limit: number };
  pensionUsage: { used: number; limit: number };
  maxSets: number;
  adjustableSets: boolean;
  tierFloor: number;
}
```

이 인터페이스를 직접 생성하는 곳은 없다(응답 파싱 전용 타입) — 기존 `progress.test.ts`의 payload 리터럴은 명시적으로 이 타입에 맞춰 선언되지 않으므로 `pensionUsage`가 없어도 컴파일 에러가 나지 않는다. 이 태스크에서 `progress.test.ts`는 수정하지 않는다.

- [ ] **Step 6: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/api.ts frontend/lib/api.test.ts frontend/lib/progress.ts
git commit -m "Add generatePension client and pensionUsage progress field"
```

---

### Task 2: `PensionDrawAnimation` 컴포넌트

**Files:**
- Create: `frontend/app/components/PensionDrawAnimation.tsx`
- Create: `frontend/app/components/PensionDrawAnimation.module.css`

**Interfaces:**
- Consumes: 없음
- Produces:
  ```ts
  interface PensionDrawAnimationProps {
    groupNo: number;
    number: string;
    onComplete: () => void;
  }
  export default function PensionDrawAnimation(props: PensionDrawAnimationProps): JSX.Element
  ```
  Task 3(`/pension` 페이지)이 이 컴포넌트를 그대로 사용한다.

이 태스크는 다른 태스크와 독립적이다. 이 코드베이스 컨벤션상(기존 `LottoDrawAnimation`도 동일) 전용 테스트가 없다 — 타입체크로 검증하고, Task 3에서 실제 페이지에 연결한 뒤 브라우저로 확인한다.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PensionDrawAnimation.module.css";

const SPIN_INTERVAL_MS = 70;
const STOP_STAGGER_MS = 450;
const FINISH_PAUSE_MS = 500;

interface PensionDrawAnimationProps {
  groupNo: number;
  number: string;
  onComplete: () => void;
}

export default function PensionDrawAnimation({ groupNo, number, onComplete }: PensionDrawAnimationProps) {
  const finalValues = useRef([String(groupNo), ...number.split("")]).current;
  const [displayValues, setDisplayValues] = useState<string[]>(finalValues.map(() => "0"));
  const completedRef = useRef(false);
  const spinIntervalsRef = useRef<number[]>([]);
  const stopTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    let stoppedCount = 0;

    function complete() {
      if (completedRef.current) return;
      completedRef.current = true;
      spinIntervalsRef.current.forEach((id) => window.clearInterval(id));
      stopTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      setDisplayValues(finalValues);
      window.setTimeout(onComplete, FINISH_PAUSE_MS);
    }

    finalValues.forEach((finalValue, i) => {
      const isGroupReel = i === 0;
      const cycleMax = isGroupReel ? 5 : 10;
      const cycleOffset = isGroupReel ? 1 : 0;

      const intervalId = window.setInterval(() => {
        setDisplayValues((prev) => {
          const next = [...prev];
          next[i] = String(Math.floor(Math.random() * cycleMax) + cycleOffset);
          return next;
        });
      }, SPIN_INTERVAL_MS);
      spinIntervalsRef.current.push(intervalId);

      const stopTimeoutId = window.setTimeout(() => {
        window.clearInterval(intervalId);
        setDisplayValues((prev) => {
          const next = [...prev];
          next[i] = finalValue;
          return next;
        });
        stoppedCount += 1;
        if (stoppedCount === finalValues.length) {
          complete();
        }
      }, STOP_STAGGER_MS * (i + 1));
      stopTimeoutsRef.current.push(stopTimeoutId);
    });

    return () => {
      spinIntervalsRef.current.forEach((id) => window.clearInterval(id));
      stopTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSkip() {
    if (completedRef.current) return;
    completedRef.current = true;
    spinIntervalsRef.current.forEach((id) => window.clearInterval(id));
    stopTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    setDisplayValues(finalValues);
    window.setTimeout(onComplete, FINISH_PAUSE_MS);
  }

  return (
    <div className={styles.wrapper} onClick={handleSkip}>
      <p className={styles.hint}>탭하면 바로 결과 보기</p>
      <div className={styles.reels}>
        <span className={styles.reel}>{displayValues[0]}조</span>
        {displayValues.slice(1).map((d, i) => (
          <span key={i} className={styles.reel}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
```

(조 릴은 1~5를 순환하고(`cycleMax=5, cycleOffset=1`), 숫자 릴 6개는 각각 0~9를 순환한다(`cycleMax=10, cycleOffset=0`). 릴마다 `STOP_STAGGER_MS`(450ms) 간격으로 순서대로 멈추고, 마지막 릴이 멈추면 `complete()`가 호출되어 짧은 정지 후 `onComplete()`를 부른다. 탭하면 `handleSkip()`이 모든 인터벌/타임아웃을 즉시 정리하고 바로 최종 값을 보여준 뒤 `onComplete()`를 부른다 — 기존 `LottoDrawAnimation`의 "탭하면 바로 결과 보기" 동작과 같은 사용자 경험이다.)

- [ ] **Step 2: 스타일 작성**

```css
.wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  user-select: none;
}

.hint {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.reels {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.reel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.2rem;
  height: 2.8rem;
  padding: 0 0.3rem;
  background: var(--surface-hover);
  border-radius: var(--radius-md);
  font-size: 1.3rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--foreground);
}
```

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음 (아직 아무 페이지도 이 컴포넌트를 쓰지 않으므로 "미사용" 경고가 있어도 무시 — Task 3에서 연결된다)

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/PensionDrawAnimation.tsx frontend/app/components/PensionDrawAnimation.module.css
git commit -m "Add PensionDrawAnimation slot-reel component"
```

---

### Task 3: `/pension` 페이지

**Files:**
- Create: `frontend/app/pension/page.tsx`
- Create: `frontend/app/pension/page.module.css`

**Interfaces:**
- Consumes: Task 1의 `generatePension`, `PensionGenerateResult`, `ProgressResult.pensionUsage`. Task 2의 `PensionDrawAnimation`.
- Produces: 없음

이 태스크는 Task 1, 2에 의존한다. 자동 테스트는 없다(페이지 컨벤션) — 타입체크 + 전체 테스트 스위트 + 브라우저 수동 확인으로 검증한다.

- [ ] **Step 1: 페이지 작성**

```tsx
"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { generatePension, type PensionGenerateResult } from "../../lib/api";
import PensionDrawAnimation from "../components/PensionDrawAnimation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

export default function PensionPage() {
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<PensionGenerateResult | null>(null);
  const [animating, setAnimating] = useState(false);
  const [pensionResult, setPensionResult] = useState<PensionGenerateResult | null>(null);

  const quotaExhausted = progress ? progress.pensionUsage.used >= progress.pensionUsage.limit : false;

  async function handleGenerate() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generatePension(auth.token);
      refreshProgress();
      setPendingResult(data);
      setAnimating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "번호 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleAnimationComplete() {
    setPensionResult(pendingResult);
    setPendingResult(null);
    setAnimating(false);
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>연금복권720+ 번호</h1>
        <p className={styles.subtitle}>
          조 1~5와 6자리 번호를 완전 무작위로 뽑아드려요.
          <br />
          실제 당첨을 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {!auth ? (
        <div className={styles.card}>
          <p className={styles.error}>연금복권 번호를 뽑으려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.generateButton}>
            카카오로 로그인
          </a>
        </div>
      ) : (
        <div className={styles.card}>
          {!animating && !pensionResult && (
            <>
              <button
                type="button"
                className={styles.generateButton}
                onClick={handleGenerate}
                disabled={loading || quotaExhausted}
              >
                {quotaExhausted ? "내일 다시 시도해주세요" : loading ? "생성 중..." : "연금복권 번호 뽑기"}
              </button>
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}

          {animating && pendingResult && (
            <PensionDrawAnimation
              groupNo={pendingResult.groupNo}
              number={pendingResult.number}
              onComplete={handleAnimationComplete}
            />
          )}

          {pensionResult && !animating && (
            <div className={styles.resultCard}>
              <span className={styles.resultText}>
                {pensionResult.groupNo}조 {pensionResult.number}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 스타일 작성**

```css
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-align: center;
}

.title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.6;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.generateButton {
  padding: 0.75rem 1.4rem;
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-foreground);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.generateButton:hover:not(:disabled) {
  background: var(--accent-hover);
}

.generateButton:active:not(:disabled) {
  transform: scale(0.98);
}

.generateButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: var(--danger);
  font-size: 0.9rem;
  text-align: center;
}

.resultCard {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 2rem;
  background: var(--surface-hover);
  border-radius: var(--radius-lg);
}

.resultText {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: 타입체크 + 전체 테스트 스위트**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 통과 (Task 1에서 추가한 테스트 포함)

- [ ] **Step 4: 브라우저에서 수동 확인**

로컬 dev 서버에서 로그인 후 `/pension` 접속:
- 뽑기 전: "연금복권 번호 뽑기" 버튼이 보이는지
- 버튼 클릭 → 릴 7개가 각각 순서대로(조 → 1번째 자리 → ... → 6번째 자리) 멈추는 연출이 재생되는지
- 애니메이션 중 탭하면 바로 결과가 표시되는지
- 연출이 끝나면 "N조 XXXXXX" 형태로 결과 카드가 표시되는지
- 오늘 이미 뽑았으면(2단계에서 만든 하루 1회 제한) 버튼이 비활성화되고 "내일 다시 시도해주세요"가 보이는지
- 로그인 안 한 상태로 접속하면 카카오 로그인 안내가 보이는지

- [ ] **Step 5: Commit**

```bash
git add frontend/app/pension/page.tsx frontend/app/pension/page.module.css
git commit -m "Add /pension draw page"
```

---

### Task 4: `Nav`/`sitemap`에 `/pension` 반영

**Files:**
- Modify: `frontend/app/components/Nav.tsx`
- Modify: `frontend/app/sitemap.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (이 플랜의 마지막 태스크)

이 태스크는 Task 3에 의존한다(페이지가 실제로 존재해야 링크가 의미 있음). 자동 테스트 없음 — 타입체크 + 브라우저로 링크 동작 확인.

- [ ] **Step 1: `Nav.tsx`의 `LINKS`에 연금복권 추가**

`frontend/app/components/Nav.tsx`에서:

```ts
const LINKS = [
  { href: "/", label: "홈" },
  { href: "/tarot", label: "타로" },
  { href: "/generate", label: "번호생성" },
  { href: "/stats", label: "통계" },
  { href: "/draws", label: "회차조회" },
];
```

를 다음으로 교체:

```ts
const LINKS = [
  { href: "/", label: "홈" },
  { href: "/tarot", label: "타로" },
  { href: "/generate", label: "번호생성" },
  { href: "/pension", label: "연금복권" },
  { href: "/stats", label: "통계" },
  { href: "/draws", label: "회차조회" },
];
```

- [ ] **Step 2: `sitemap.ts`의 `ROUTES`에 `/pension` 추가**

`frontend/app/sitemap.ts`에서:

```ts
const ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/tarot", priority: 0.9 },
  { path: "/generate", priority: 0.8 },
  { path: "/stats", priority: 0.8 },
  { path: "/draws", priority: 0.8 },
];
```

를 다음으로 교체:

```ts
const ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/tarot", priority: 0.9 },
  { path: "/generate", priority: 0.8 },
  { path: "/pension", priority: 0.8 },
  { path: "/stats", priority: 0.8 },
  { path: "/draws", priority: 0.8 },
];
```

- [ ] **Step 3: 타입체크 + 전체 테스트 스위트**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 통과

- [ ] **Step 4: 브라우저에서 확인**

네비게이션 바에 "연금복권" 링크가 보이고 클릭하면 `/pension`으로 이동하는지 확인 (모바일 햄버거 메뉴 안에서도 보이는지 함께 확인).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/Nav.tsx frontend/app/sitemap.ts
git commit -m "Add /pension to nav links and sitemap"
```

---

## 배포 참고사항

없음 — 프론트엔드 전용 정적 변경, 백엔드는 2단계에서 이미 배포됨. `git push` 한 번으로 Vercel에 반영된다.

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서의 `lib/api.ts`/`lib/progress.ts` 확장(Task 1), 슬롯머신 연출(Task 2), `/pension` 페이지(Task 3), 네비게이션/사이트맵 반영(Task 4) 전부 태스크로 반영됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 없음 — 전 스텝에 실제 코드/명령어 포함.
- **타입 일관성:** `PensionGenerateResult { groupNo, number }`(Task 1에서 정의)를 Task 2(`PensionDrawAnimation` props)와 Task 3(`/pension` 페이지 state)이 동일한 필드명으로 사용. `ProgressResult.pensionUsage`(Task 1)를 Task 3의 `quotaExhausted` 계산이 그대로 참조. `PensionDrawAnimation`의 props(`groupNo: number, number: string, onComplete: () => void`, Task 2에서 정의)를 Task 3의 JSX가 정확히 그 이름으로 전달함을 확인함.
- **기존 코드 영향 범위 확인:** `/generate`, `LottoDrawAnimation`, 기존 `Nav.tsx`/`sitemap.ts`의 다른 라우트 항목은 이 플랜에서 삭제/수정 없이 그대로 유지되고 새 항목만 추가된다.
