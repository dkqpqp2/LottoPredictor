# 타로 카드 부채꼴 스프레드 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/tarot`의 78장 전체 그리드 대신, 78장 중 무작위 20장만 부채꼴(호 모양, 겹침)로 펼쳐 보여주고 딜링 애니메이션 + "다시 섞기" 버튼을 추가한다.

**Architecture:** 부채꼴 위치 계산은 순수 함수(`computeFanTransform`)로, 20장 뽑기/재셔플 로직은 `buildFanDeck` 함수로 분리하고, 렌더링은 새 `TarotFanSpread` 컴포넌트가 담당한다. `page.tsx`는 기존 `.spread` 그리드 두 곳을 이 컴포넌트로 교체한다.

**Tech Stack:** Next.js 16 / TypeScript / Vitest (신규 라이브러리 없음 — 순수 CSS 트랜지션만 사용)

## Global Constraints

- 카드 한 장을 뽑는 모드(별자리 함께보기 / 번호 뽑기용 타로)와 세 장을 순서대로 뽑는 모드(타로만 보기) 모두 동일하게 적용한다.
- 부채에 한 번에 보이는 카드는 20장(`FAN_SIZE`)이다.
- "다시 섞기" 버튼은 78장(3장 모드에서는 이미 뽑은 카드 제외) 중 완전히 새로운 20장을 다시 뽑고, 딜링 애니메이션을 재생한다.
- 3장 모드에서 카드를 한 장 고르면 그 카드만 부채에서 빠지고 나머지는 유지하되(재셔플 없음) 부채 모양만 재계산해서 자리를 채운다 — 이때 딜링 애니메이션은 재생하지 않는다.
- 좁은 화면에서 부채의 각도/반지름이 자동으로 줄어들어 컨테이너 밖으로 삐져나가지 않는다.
- 실제 카드가 뒤섞이는 정교한 물리 셔플 애니메이션은 범위 밖이다 — "모였다가 부채로 펼쳐지는" 딜링 동작으로 대신한다.
- 백엔드/DB 변경 없음 (프론트엔드 전용).

---

### Task 1: `computeFanTransform` 순수 함수

**Files:**
- Create: `frontend/lib/fanLayout.ts`
- Test: `frontend/lib/fanLayout.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 함수, 외부 의존성 없음)
- Produces: `computeFanTransform(index: number, total: number, containerWidth: number): { x: number; y: number; rotate: number }` — Task 3의 `TarotFanSpread` 컴포넌트가 이 함수를 호출해 각 카드의 인라인 `transform` 스타일을 계산한다.

이 태스크는 다른 모든 태스크와 독립적이다 — 순수 수학 함수라 카드 데이터나 컴포넌트 없이 테스트 가능하다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/fanLayout.test.ts`를 새로 만든다:

```ts
import { describe, expect, it } from "vitest";
import { computeFanTransform } from "./fanLayout";

describe("computeFanTransform", () => {
  it("returns no offset when there is only one card", () => {
    expect(computeFanTransform(0, 1, 480)).toEqual({ x: 0, y: 0, rotate: 0 });
  });

  it("places the middle card of an odd-sized fan dead center", () => {
    const middle = computeFanTransform(1, 3, 480);
    expect(middle.x).toBeCloseTo(0);
    expect(middle.y).toBeCloseTo(0);
    expect(middle.rotate).toBeCloseTo(0);
  });

  it("mirrors the leftmost and rightmost card horizontally and by rotation", () => {
    const left = computeFanTransform(0, 5, 480);
    const right = computeFanTransform(4, 5, 480);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.rotate).toBeCloseTo(-right.rotate);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
  });

  it("droops cards further from center lower than the center card", () => {
    const center = computeFanTransform(2, 5, 480);
    const edge = computeFanTransform(0, 5, 480);
    expect(edge.y).toBeGreaterThan(center.y);
  });

  it("shrinks the spread on a narrower container", () => {
    const wide = computeFanTransform(0, 5, 480);
    const narrow = computeFanTransform(0, 5, 260);
    expect(Math.abs(narrow.x)).toBeLessThan(Math.abs(wide.x));
  });

  it("clamps container width below the minimum to the same result as the minimum", () => {
    const atMin = computeFanTransform(0, 5, 260);
    const belowMin = computeFanTransform(0, 5, 100);
    expect(belowMin).toEqual(atMin);
  });

  it("clamps container width above the reference to the same result as the reference", () => {
    const atRef = computeFanTransform(0, 5, 480);
    const aboveRef = computeFanTransform(0, 5, 900);
    expect(aboveRef).toEqual(atRef);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/fanLayout.test.ts`
Expected: FAIL — `Cannot find module './fanLayout'` (파일이 아직 없음)

- [ ] **Step 3: 구현 작성**

`frontend/lib/fanLayout.ts`를 새로 만든다:

```ts
const MAX_ANGLE_DEG = 70;
const MIN_ANGLE_DEG = 30;
const REFERENCE_WIDTH = 480;
const MIN_WIDTH = 260;
const BASE_RADIUS = 240;
const MIN_RADIUS = 130;

export interface FanTransform {
  x: number;
  y: number;
  rotate: number;
}

function clampWidth(containerWidth: number): number {
  return Math.max(MIN_WIDTH, Math.min(REFERENCE_WIDTH, containerWidth));
}

/**
 * total장을 좌우 대칭 호 모양으로 배치한다. index 0은 맨 왼쪽, index (total-1)은
 * 맨 오른쪽, 가운데 인덱스가 정점(가장 위)이고 양 끝으로 갈수록 아래로 처진다.
 * containerWidth가 좁을수록 각도/반지름이 줄어들어 좁은 화면에서도 부채가
 * 컨테이너 밖으로 넘치지 않는다.
 */
export function computeFanTransform(index: number, total: number, containerWidth: number): FanTransform {
  if (total <= 1) {
    return { x: 0, y: 0, rotate: 0 };
  }

  const clampedWidth = clampWidth(containerWidth);
  const widthFactor = (clampedWidth - MIN_WIDTH) / (REFERENCE_WIDTH - MIN_WIDTH);
  const maxAngle = MIN_ANGLE_DEG + (MAX_ANGLE_DEG - MIN_ANGLE_DEG) * widthFactor;
  const radius = MIN_RADIUS + (BASE_RADIUS - MIN_RADIUS) * widthFactor;

  const t = index / (total - 1) - 0.5;
  const angleDeg = t * maxAngle;
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: Math.sin(angleRad) * radius,
    y: radius * (1 - Math.cos(angleRad)),
    rotate: angleDeg,
  };
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/fanLayout.test.ts`
Expected: 전부 통과 (7 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/fanLayout.ts frontend/lib/fanLayout.test.ts
git commit -m "Add pure function for computing tarot fan-spread card positions"
```

---

### Task 2: `buildFanDeck` / `FAN_SIZE`

**Files:**
- Modify: `frontend/lib/tarotCards.ts` (파일 맨 끝, `shuffleCards` 함수 뒤에 추가)
- Test: `frontend/lib/tarotCards.test.ts`

**Interfaces:**
- Consumes: 기존 `TarotCard` 타입, 기존 `shuffleCards(cards: TarotCard[]): TarotCard[]` (내부에서 재사용, 변경 없음)
- Produces: `FAN_SIZE = 20` (상수), `buildFanDeck(pool: TarotCard[], exclude: Set<number>, count: number = FAN_SIZE): TarotCard[]` — Task 4에서 `page.tsx`가 이 함수를 호출해 `fanDeck` state를 채운다.

이 태스크는 Task 1, Task 3과 독립적이다 — 카드 배열 필터링/셔플만 다루는 순수 함수라 컴포넌트 없이 테스트 가능하다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/tarotCards.test.ts` 맨 위 import를 다음으로 교체:

```ts
import { describe, expect, it } from "vitest";
import { TAROT_CARDS, shuffleCards, buildFanDeck, FAN_SIZE } from "./tarotCards";
```

파일 맨 끝에 새 `describe` 블록을 추가:

```ts
describe("buildFanDeck", () => {
  it("returns FAN_SIZE cards when the pool is large enough", () => {
    const deck = buildFanDeck(TAROT_CARDS, new Set());
    expect(deck).toHaveLength(FAN_SIZE);
  });

  it("excludes card numbers passed in the exclude set", () => {
    const excluded = new Set([0, 1, 2]);
    const deck = buildFanDeck(TAROT_CARDS, excluded, 75);
    expect(deck.some((c) => excluded.has(c.number))).toBe(false);
  });

  it("returns fewer cards than count when the pool after exclusion is smaller", () => {
    const excluded = new Set(TAROT_CARDS.slice(3).map((c) => c.number));
    const deck = buildFanDeck(TAROT_CARDS, excluded, FAN_SIZE);
    expect(deck).toHaveLength(3);
  });

  it("respects a custom count", () => {
    const deck = buildFanDeck(TAROT_CARDS, new Set(), 5);
    expect(deck).toHaveLength(5);
  });

  it("does not mutate the input pool", () => {
    const original = [...TAROT_CARDS];
    buildFanDeck(TAROT_CARDS, new Set());
    expect(TAROT_CARDS).toEqual(original);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/tarotCards.test.ts`
Expected: FAIL — `buildFanDeck`/`FAN_SIZE`가 정의되지 않음

- [ ] **Step 3: 구현 작성**

`frontend/lib/tarotCards.ts` 맨 끝, `shuffleCards` 함수 뒤에 추가:

```ts
export const FAN_SIZE = 20;

export function buildFanDeck(pool: TarotCard[], exclude: Set<number>, count: number = FAN_SIZE): TarotCard[] {
  const remaining = pool.filter((c) => !exclude.has(c.number));
  return shuffleCards(remaining).slice(0, count);
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/tarotCards.test.ts`
Expected: 전부 통과 (기존 테스트 포함 전체 통과)

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/tarotCards.ts frontend/lib/tarotCards.test.ts
git commit -m "Add buildFanDeck for drawing a random 20-card fan from the full deck"
```

---

### Task 3: `TarotFanSpread` 컴포넌트

**Files:**
- Create: `frontend/app/tarot/TarotFanSpread.tsx`
- Create: `frontend/app/tarot/TarotFanSpread.module.css`

**Interfaces:**
- Consumes: Task 1의 `computeFanTransform(index, total, containerWidth)`, 기존 `TarotCard` 타입
- Produces:
  ```ts
  interface TarotFanSpreadProps {
    cards: TarotCard[];
    onPick: (card: TarotCard) => void;
    dealKey: number;
  }
  export default function TarotFanSpread(props: TarotFanSpreadProps): JSX.Element
  ```
  Task 4에서 `page.tsx`가 기존 `.spread` 그리드 렌더링 두 곳을 이 컴포넌트로 교체한다.

이 태스크는 Task 1(완료 필요)에 의존하고, Task 2와는 독립적이다. 컴포넌트 자체는 자동 테스트가 없다 — 이 프로젝트의 vitest 설정(`environment: 'node'`)에는 React 컴포넌트 렌더링 테스트 인프라(jsdom, React Testing Library)가 없고, 기존 드래그-공개 인터랙션(`page.tsx`의 `handlePointerDown` 등)도 같은 이유로 컴포넌트 테스트 없이 브라우저 수동 확인으로 검증해왔다 — 이번에도 같은 관례를 따른다. Task 4에서 실제 페이지에 연결한 뒤 브라우저로 확인한다.

- [ ] **Step 1: 컴포넌트 작성**

`frontend/app/tarot/TarotFanSpread.tsx`를 새로 만든다:

```tsx
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./TarotFanSpread.module.css";
import { computeFanTransform } from "../../lib/fanLayout";
import type { TarotCard } from "../../lib/tarotCards";

interface TarotFanSpreadProps {
  cards: TarotCard[];
  onPick: (card: TarotCard) => void;
  dealKey: number;
}

const DEFAULT_CONTAINER_WIDTH = 480;

export default function TarotFanSpread({ cards, onPick, dealKey }: TarotFanSpreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(DEFAULT_CONTAINER_WIDTH);
  const [dealt, setDealt] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Plays the "collapsed -> fanned out" dealing animation on mount, and again
  // every time dealKey changes (the "다시 섞기" button). Does NOT replay when
  // `cards` merely shrinks by one (a card was picked) — dealKey stays the same
  // in that case, so the remaining cards just reflow via the CSS transition.
  useEffect(() => {
    setDealt(false);
    const id = requestAnimationFrame(() => setDealt(true));
    return () => cancelAnimationFrame(id);
  }, [dealKey]);

  return (
    <div ref={containerRef} className={styles.fanContainer}>
      {cards.map((card, i) => {
        const transform = dealt
          ? computeFanTransform(i, cards.length, containerWidth)
          : { x: 0, y: 0, rotate: 0 };
        return (
          <button
            key={card.number}
            type="button"
            className={styles.fanCard}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotate}deg) scale(${dealt ? 1 : 0.6})`,
              opacity: dealt ? 1 : 0,
              transitionDelay: `${i * 18}ms`,
              zIndex: i,
            }}
            onClick={() => onPick(card)}
            aria-label={`카드 ${i + 1}`}
          >
            <span className={styles.fanCardSymbol}>✦</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 스타일 작성**

`frontend/app/tarot/TarotFanSpread.module.css`를 새로 만든다:

```css
.fanContainer {
  position: relative;
  height: 220px;
  margin: 0 auto;
  max-width: 32rem;
}

.fanCard {
  position: absolute;
  left: 50%;
  top: 0;
  width: 3.2rem;
  aspect-ratio: 2 / 3;
  margin-left: -1.6rem;
  border-radius: 8px;
  border: 1px solid var(--cosmic-gold-soft);
  background: linear-gradient(160deg, #2a1a5e, #171034);
  color: var(--cosmic-gold);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.3s ease;
}

.fanCard:hover {
  filter: brightness(1.15);
}

.fanCardSymbol {
  color: var(--cosmic-gold);
}
```

(카드 위치가 인라인 `style.transform`으로 매 렌더마다 계산되기 때문에, 기존 `.cardBack:hover`가 쓰던 `transform: translateY(-3px)` 방식은 인라인 transform과 충돌한다 — 대신 `filter: brightness(1.15)`로 호버 피드백을 준다.)

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음 (아직 아무 파일도 이 컴포넌트를 사용하지 않으므로 미사용 경고만 있다면 무시 — Task 4에서 연결된다)

- [ ] **Step 4: Commit**

```bash
git add frontend/app/tarot/TarotFanSpread.tsx frontend/app/tarot/TarotFanSpread.module.css
git commit -m "Add TarotFanSpread component for the fan-shaped card spread"
```

---

### Task 4: `page.tsx`에 연결 + 다시 섞기 버튼 + 죽은 CSS 정리

**Files:**
- Modify: `frontend/app/tarot/page.tsx`
- Modify: `frontend/app/tarot/page.module.css`

**Interfaces:**
- Consumes: Task 2의 `buildFanDeck`/`FAN_SIZE`, Task 3의 `TarotFanSpread` 컴포넌트
- Produces: 없음 (최종 사용처 — 이후 태스크 없음)

이 태스크는 Task 2와 Task 3이 모두 끝난 뒤 진행한다. 자동 테스트는 없다(UI 배선) — 타입체크 + 전체 테스트 스위트 + 브라우저 수동 확인으로 검증한다.

- [ ] **Step 1: import 교체**

`frontend/app/tarot/page.tsx`의 7번 줄:

```ts
import { DIRECTION_LABELS, TAROT_CARDS, shuffleCards, type CardDirection, type TarotCard } from "../../lib/tarotCards";
```

를 다음으로 교체:

```ts
import { DIRECTION_LABELS, TAROT_CARDS, buildFanDeck, type CardDirection, type TarotCard } from "../../lib/tarotCards";
```

그리고 11번 줄(`import LottoDrawAnimation from "../components/LottoDrawAnimation";`) 바로 다음 줄에 추가:

```ts
import TarotFanSpread from "./TarotFanSpread";
```

- [ ] **Step 2: `deck` state를 `fanDeck`으로 교체 + `dealKey` state 추가**

48번 줄:

```ts
  const [deck, setDeck] = useState<TarotCard[]>(() => shuffleCards(TAROT_CARDS));
```

를 다음으로 교체:

```ts
  const [fanDeck, setFanDeck] = useState<TarotCard[]>(() => buildFanDeck(TAROT_CARDS, new Set()));
  const [dealKey, setDealKey] = useState(0);
```

- [ ] **Step 3: `handleCardClick`에서 `deck` 참조를 `fanDeck`으로 교체 + `handleReshuffleFan` 추가**

130-139번 줄:

```ts
  function handleCardClick(card: TarotCard) {
    if (isSingleCardMode) {
      if (selected) return;
      setSelected(card);
    } else if (viewMode === "tarot-only") {
      if (spreadSlots.length >= SPREAD_SIZE || revealingCard) return;
      setSpreadSlots((prev) => [...prev, { card, direction: null }]);
      setDeck((prev) => prev.filter((c) => c.number !== card.number));
    }
  }
```

를 다음으로 교체 (마지막 줄의 `setDeck` → `setFanDeck`, 그리고 바로 뒤에 `handleReshuffleFan` 함수 추가):

```ts
  function handleCardClick(card: TarotCard) {
    if (isSingleCardMode) {
      if (selected) return;
      setSelected(card);
    } else if (viewMode === "tarot-only") {
      if (spreadSlots.length >= SPREAD_SIZE || revealingCard) return;
      setSpreadSlots((prev) => [...prev, { card, direction: null }]);
      setFanDeck((prev) => prev.filter((c) => c.number !== card.number));
    }
  }

  function handleReshuffleFan() {
    const exclude =
      viewMode === "tarot-only" ? new Set(spreadSlots.map((s) => s.card.number)) : new Set<number>();
    setFanDeck(buildFanDeck(TAROT_CARDS, exclude));
    setDealKey((k) => k + 1);
  }
```

- [ ] **Step 4: `handleReset`에서 `deck` 재생성 부분 교체**

278번 줄 (`handleReset` 함수 안):

```ts
  function handleReset() {
    setDeck(shuffleCards(TAROT_CARDS));
```

를 다음으로 교체:

```ts
  function handleReset() {
    setFanDeck(buildFanDeck(TAROT_CARDS, new Set()));
    setDealKey((k) => k + 1);
```

- [ ] **Step 5: 단일 카드 모드 뽑기 화면 JSX 교체**

475-492번 줄:

```tsx
      {isSingleCardMode && !selected && canPickCard && (
        <div className={styles.spreadWrapper}>
          <p className={styles.hint}>카드 한 장을 골라주세요.</p>
          <div className={styles.spread}>
            {deck.map((card, i) => (
              <button
                key={card.number}
                type="button"
                className={styles.cardBack}
                onClick={() => handleCardClick(card)}
                aria-label={`카드 ${i + 1}`}
              >
                <span className={styles.cardBackSymbol}>✦</span>
              </button>
            ))}
          </div>
        </div>
      )}
```

를 다음으로 교체:

```tsx
      {isSingleCardMode && !selected && canPickCard && (
        <div className={styles.spreadWrapper}>
          <div className={styles.spreadHintRow}>
            <p className={styles.hint}>카드 한 장을 골라주세요.</p>
            <button type="button" className={styles.reshuffleButton} onClick={handleReshuffleFan}>
              다시 섞기
            </button>
          </div>
          <TarotFanSpread cards={fanDeck} onPick={handleCardClick} dealKey={dealKey} />
        </div>
      )}
```

- [ ] **Step 6: 3장 모드 뽑기 화면 JSX 교체**

바로 다음 블록(교체 전 494-513번 줄):

```tsx
      {viewMode === "tarot-only" && nextPositionLabel && (
        <div className={styles.spreadWrapper}>
          <p className={styles.hint}>
            "{nextPositionLabel}" 카드를 골라주세요. ({spreadSlots.length + 1}/{SPREAD_SIZE})
          </p>
          <div className={styles.spread}>
            {deck.map((card, i) => (
              <button
                key={card.number}
                type="button"
                className={styles.cardBack}
                onClick={() => handleCardClick(card)}
                aria-label={`카드 ${i + 1}`}
              >
                <span className={styles.cardBackSymbol}>✦</span>
              </button>
            ))}
          </div>
        </div>
      )}
```

를 다음으로 교체:

```tsx
      {viewMode === "tarot-only" && nextPositionLabel && (
        <div className={styles.spreadWrapper}>
          <div className={styles.spreadHintRow}>
            <p className={styles.hint}>
              "{nextPositionLabel}" 카드를 골라주세요. ({spreadSlots.length + 1}/{SPREAD_SIZE})
            </p>
            <button type="button" className={styles.reshuffleButton} onClick={handleReshuffleFan}>
              다시 섞기
            </button>
          </div>
          <TarotFanSpread cards={fanDeck} onPick={handleCardClick} dealKey={dealKey} />
        </div>
      )}
```

- [ ] **Step 7: `page.module.css`에 새 스타일 추가, 죽은 스타일 제거**

`frontend/app/tarot/page.module.css`에서 다음 블록을 찾는다(239-272번 줄 부근):

```css
.spreadWrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.spread {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3.2rem, 1fr));
  gap: 0.5rem;
}

.cardBack {
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  border: 1px solid var(--cosmic-gold-soft);
  background: linear-gradient(160deg, #2a1a5e, #171034);
  color: var(--cosmic-gold);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cardBack:hover {
  transform: translateY(-3px);
  border-color: var(--cosmic-gold);
}

.cardBackSymbol {
  color: var(--cosmic-gold);
}
```

를 다음으로 교체. **주의: `.cardBackSymbol`은 여기서 지우지 않는다** — 이 파일 안 `revealWrapper` 블록(카드를 드래그해서 뒤집는 화면, `page.tsx`의 521-531번 줄 `<span className={styles.cardBackSymbol}>✦</span>`)이 계속 이 클래스를 쓰고 있다. 삭제해도 되는 건 이번에 교체하는 두 그리드 블록에서만 쓰이던 `.spread`/`.cardBack`뿐이다 (`grep -n "styles\\.spread\\b\\|styles\\.cardBack"`로 확인함 — `.cardBackSymbol`은 530번 줄에서 별개로 쓰이므로 검색 결과에 나오는 530번 줄 사용처는 그대로 둔다):

```css
.spreadWrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.spreadHintRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.reshuffleButton {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--cosmic-border);
  border-radius: 999px;
  background: transparent;
  color: var(--cosmic-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.reshuffleButton:hover {
  color: var(--cosmic-text);
  border-color: var(--cosmic-gold);
}

.cardBackSymbol {
  color: var(--cosmic-gold);
}
```

- [ ] **Step 8: 타입체크 + 전체 테스트 스위트**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 통과 (Task 1, 2에서 추가한 테스트 포함)

- [ ] **Step 9: 브라우저 수동 확인**

로컬 dev 서버에서 `/tarot`에 로그인 후 접속해 다음을 확인한다:
- "타로만 보기" 모드: 카드 뽑기 화면 진입 시 카드들이 가운데서 모였다가 부채꼴로 펼쳐지는 애니메이션이 보이는지, 부채가 20장인지.
- 카드를 한 장 고르면 딜링 애니메이션 없이 나머지 카드들이 부드럽게 재배치되는지 (3장 모드 기준, 포지션 1 → 2 확인).
- "다시 섞기" 버튼을 누르면 카드 구성이 바뀌고 딜링 애니메이션이 다시 재생되는지.
- 3장 모드에서 포지션 1을 고른 뒤 "다시 섞기"를 눌렀을 때, 이미 고른 카드가 새 부채에 다시 나타나지 않는지.
- "번호 뽑기용 타로"/"생년월일로 별자리도 함께 보기" 모드에서도 동일하게 부채꼴 뽑기 화면이 나오는지.
- 브라우저 창을 모바일 폭으로 줄였을 때 부채가 화면 밖으로 삐져나가지 않고 각도/반지름이 줄어드는지.

- [ ] **Step 10: Commit**

```bash
git add frontend/app/tarot/page.tsx frontend/app/tarot/page.module.css
git commit -m "Replace the 78-card grid with a 20-card fan spread and reshuffle button"
```

---

## 배포 참고사항 (이 플랜 밖의 수동 작업)

없음 — 프론트엔드 전용 정적 UI 변경이라 백엔드/DB 마이그레이션이 필요 없다. `git push` 한 번으로 Vercel에 반영된다.

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서의 20장 부채꼴 배치, 딜링 애니메이션, 다시 섞기(78장/제외 로직), 카드 픽 시 재배치(딜링 없음), 반응형 축소, 두 모드 모두 적용 — 전부 Task 1~4에 반영됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 없음 — 모든 스텝에 실제 코드/명령어 포함.
- **타입 일관성:** `TarotFanSpreadProps`(Task 3에서 정의)를 Task 4의 `page.tsx`가 그대로 사용 (`cards`/`onPick`/`dealKey` 이름과 타입 일치 확인함). `buildFanDeck`의 시그니처(Task 2에서 정의)를 Task 4의 `handleReset`/`handleReshuffleFan`이 그대로 사용 (인자 순서 `(pool, exclude, count?)` 일치 확인함).
- **`deck` → `fanDeck` 이름 변경 누락 확인:** `page.tsx` 안에서 `deck`/`setDeck`을 참조하는 곳은 48번 줄(선언), 137번 줄(`handleCardClick`), 279번 줄(`handleReset`), 그리고 두 JSX 블록(각각 `deck.map`)뿐임을 grep으로 확인함 — Task 4의 Step 2~6이 이 다섯 곳을 전부 다룬다.
- **죽은 CSS 정리 중 오탐 발견:** 처음에는 `.spread`/`.cardBack`/`.cardBackSymbol` 세 클래스를 전부 삭제하려 했으나, grep으로 확인해보니 `.cardBackSymbol`은 이번에 교체하는 두 그리드 블록과 무관한 `revealWrapper`(카드 드래그해서 뒤집는 화면, 530번 줄)에서도 쓰이고 있었다. Task 4 Step 7을 `.spread`/`.cardBack`만 삭제하고 `.cardBackSymbol`은 유지하도록 수정함.
