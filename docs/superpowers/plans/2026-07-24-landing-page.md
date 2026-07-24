# 소개/랜딩 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈(`/`)을 서비스 소개 랜딩 페이지로 바꾸고, 기존 타로 페이지는 `/tarot`로 옮긴다.

**Architecture:** 기존 타로 페이지(현재 `app/page.tsx`)를 파일 이동으로 `app/tarot/page.tsx`로 옮기고, 새 `app/page.tsx`를 정적 소개 페이지(히어로 + CTA + 기능 카드 3개)로 신설한다. Nav와 sitemap에 새 라우트를 반영한다.

**Tech Stack:** Next.js 16 App Router (TypeScript, CSS Modules), 기존 코드베이스 컨벤션 재사용.

## Global Constraints

- 새 랜딩 페이지는 타로 페이지(`/tarot`)의 우주/신비 다크 콘셉(CSS 커스텀 프로퍼티 `--cosmic-bg`, `--cosmic-surface`, `--cosmic-border`, `--cosmic-text`, `--cosmic-text-secondary`, `--cosmic-gold`, `--cosmic-gold-soft`와 별이 흩뿌려진 배경 그라디언트)을 그대로 재사용한다 — 사이트 라이트/다크 모드와 무관하게 항상 다크
- 메인 CTA는 "타로 보러가기" → `/tarot`
- 기능 카드 3개: 타로 운세(`/tarot`), 번호 생성(`/generate`), 통계 & 회차조회(`/stats`) — 정확히 스펙에 적힌 문구 사용
- 프론트 lib/컴포넌트 파일은 상대경로 import 사용 (기존 컨벤션)
- React 컴포넌트는 기존 컨벤션대로 자동 테스트 없이 타입체크 + 브라우저 수동 확인으로 검증 (이 프로젝트 vitest 설정에 jsdom 없음)

---

### Task 1: 타로 페이지를 `/tarot`로 이동

**Files:**
- Move: `frontend/app/page.tsx` → `frontend/app/tarot/page.tsx`
- Move: `frontend/app/page.module.css` → `frontend/app/tarot/page.module.css`
- Modify: `frontend/app/tarot/page.tsx` (이동 후 상대경로 import 수정)

**Interfaces:**
- Produces: `/tarot` 경로에서 기존 타로 페이지가 그대로 동작. `LottoDrawAnimation`, `lib/lottoBall`, `lib/tarotCards`, `lib/dragDirection`, `lib/tarotNumberGenerator`, `lib/zodiac` 등 기존 의존성은 전부 그대로 재사용 (내용 변경 없음, import 경로만 조정).

이 태스크가 끝나면 `/`는 일시적으로 404가 된다 (Task 2에서 복구됨) — 정상이다.

- [ ] **Step 1: 파일 이동 (git mv로 히스토리 보존)**

```bash
cd frontend
mkdir -p app/tarot
git mv app/page.tsx app/tarot/page.tsx
git mv app/page.module.css app/tarot/page.module.css
```

- [ ] **Step 2: 이동된 파일의 상대경로 import 수정**

`frontend/app/tarot/page.tsx`의 최상단 import 블록(현재 이렇게 되어 있음):

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { getBallColor } from "../lib/lottoBall";
import { DIRECTION_LABELS, TAROT_CARDS, shuffleCards, type CardDirection, type TarotCard } from "../lib/tarotCards";
import { detectDragDirection } from "../lib/dragDirection";
import { generateTarotNumbers, generateTarotNumbersForPicks, type CardPick } from "../lib/tarotNumberGenerator";
import { getZodiacSign, type ZodiacSign } from "../lib/zodiac";
import LottoDrawAnimation from "./components/LottoDrawAnimation";
```

다음으로 교체 (파일이 한 단계 깊어졌으므로 `../` → `../../`로, `./components`는 `../components`로):

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { getBallColor } from "../../lib/lottoBall";
import { DIRECTION_LABELS, TAROT_CARDS, shuffleCards, type CardDirection, type TarotCard } from "../../lib/tarotCards";
import { detectDragDirection } from "../../lib/dragDirection";
import { generateTarotNumbers, generateTarotNumbersForPicks, type CardPick } from "../../lib/tarotNumberGenerator";
import { getZodiacSign, type ZodiacSign } from "../../lib/zodiac";
import LottoDrawAnimation from "../components/LottoDrawAnimation";
```

`styles from "./page.module.css"`는 파일과 같이 이동했으므로 변경하지 않는다. 파일 안의 `` `/tarot/${...}.jpg` `` 같은 이미지 경로들(`public/tarot/` 폴더를 가리키는 절대 URL 경로)은 라우트 이동과 무관하니 손대지 않는다.

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add frontend/app/tarot/page.tsx frontend/app/tarot/page.module.css
git commit -m "Move tarot page to /tarot"
```

---

### Task 2: 새 소개/랜딩 페이지 (`/`)

**Files:**
- Create: `frontend/app/page.tsx`
- Create: `frontend/app/page.module.css`

**Interfaces:**
- Consumes: 없음 (정적 페이지, `next/link`만 사용)
- Produces: `/` 경로에서 소개 페이지 렌더링 (히어로 + CTA + 기능 카드 3개)

- [ ] **Step 1: `page.module.css` 작성**

```css
.page {
  --cosmic-bg: #100a2e;
  --cosmic-surface: #1c1444;
  --cosmic-border: #3a2b6e;
  --cosmic-text: #ece7fb;
  --cosmic-text-secondary: #b3a6dd;
  --cosmic-gold: #e0b84f;
  --cosmic-gold-soft: #4a3a1f;

  max-width: 640px;
  margin: 0 auto;
  padding: 4rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  min-height: 100vh;
  background:
    radial-gradient(1px 1px at 10% 20%, #ffffff 100%, transparent),
    radial-gradient(1px 1px at 80% 10%, #ffffff 100%, transparent),
    radial-gradient(1px 1px at 60% 35%, #ffffff 100%, transparent),
    radial-gradient(1.5px 1.5px at 30% 60%, #ffffff 100%, transparent),
    radial-gradient(1px 1px at 90% 70%, #ffffff 100%, transparent),
    radial-gradient(1.5px 1.5px at 45% 85%, #ffffff 100%, transparent),
    radial-gradient(1px 1px at 15% 90%, #ffffff 100%, transparent),
    linear-gradient(160deg, #0b0730 0%, #1a103d 45%, #2a1454 100%);
  background-color: var(--cosmic-bg);
  color: var(--cosmic-text);
  color-scheme: dark;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.title {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--cosmic-gold);
  text-shadow: 0 0 18px rgba(224, 184, 79, 0.35);
}

.subtitle {
  color: var(--cosmic-text-secondary);
  font-size: 1rem;
  line-height: 1.6;
  max-width: 26rem;
}

.ctaButton {
  margin-top: 0.5rem;
  padding: 0.9rem 2rem;
  border-radius: 999px;
  background: var(--cosmic-gold);
  color: #241a02;
  font-size: 1rem;
  font-weight: 700;
  transition: filter 0.15s ease;
}

.ctaButton:hover {
  filter: brightness(1.1);
}

.featureGrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.featureCard {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.5rem;
  background: var(--cosmic-surface);
  border: 1px solid var(--cosmic-border);
  border-radius: 18px;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.featureCard:hover {
  border-color: var(--cosmic-gold);
  background: var(--cosmic-gold-soft);
}

.featureTitle {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--cosmic-gold);
}

.featureDescription {
  font-size: 0.9rem;
  color: var(--cosmic-text-secondary);
  line-height: 1.5;
}
```

- [ ] **Step 2: `page.tsx` 작성**

```tsx
import Link from "next/link";
import styles from "./page.module.css";

const FEATURES = [
  {
    href: "/tarot",
    title: "타로 운세",
    description: "카드를 뽑고 방향을 정해 나만의 타로 리딩과 행운의 번호를 받아보세요.",
  },
  {
    href: "/generate",
    title: "번호 생성",
    description: "역대 당첨번호 출현 빈도를 반영한 가중치 방식으로 번호를 뽑아드려요.",
  },
  {
    href: "/stats",
    title: "통계 & 회차조회",
    description: "번호별 출현 통계와 역대 당첨번호를 한눈에 확인하세요.",
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>로타로</h1>
        <p className={styles.subtitle}>타로 카드와 로또 통계로 만나는, 나만의 특별한 번호</p>
        <Link href="/tarot" className={styles.ctaButton}>
          타로 보러가기
        </Link>
      </section>

      <section className={styles.featureGrid}>
        {FEATURES.map((feature) => (
          <Link key={feature.href} href={feature.href} className={styles.featureCard}>
            <span className={styles.featureTitle}>{feature.title}</span>
            <p className={styles.featureDescription}>{feature.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
```

이 컴포넌트는 상태나 이벤트 핸들러가 없는 서버 컴포넌트라 `"use client"`가 필요 없다 (기존 타로 페이지와 다른 점).

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add frontend/app/page.tsx frontend/app/page.module.css
git commit -m "Add landing page at /"
```

---

### Task 3: Nav & sitemap에 `/tarot` 반영 + 전체 흐름 확인

**Files:**
- Modify: `frontend/app/components/Nav.tsx`
- Modify: `frontend/app/sitemap.ts`

**Interfaces:**
- Consumes: Task 1에서 만들어진 `/tarot` 라우트, Task 2에서 만들어진 `/` 랜딩 페이지

- [ ] **Step 1: `Nav.tsx`의 `LINKS` 배열에 "타로" 추가**

`frontend/app/components/Nav.tsx`에서 다음을 찾아:

```tsx
const LINKS = [
  { href: "/", label: "홈" },
  { href: "/generate", label: "번호생성" },
  { href: "/stats", label: "통계" },
  { href: "/draws", label: "회차조회" },
  { href: "/collect", label: "수집하기" },
];
```

다음으로 교체:

```tsx
const LINKS = [
  { href: "/", label: "홈" },
  { href: "/tarot", label: "타로" },
  { href: "/generate", label: "번호생성" },
  { href: "/stats", label: "통계" },
  { href: "/draws", label: "회차조회" },
  { href: "/collect", label: "수집하기" },
];
```

- [ ] **Step 2: `sitemap.ts`에 `/tarot` 라우트 추가**

`frontend/app/sitemap.ts`에서 다음을 찾아:

```ts
const ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/generate", priority: 0.8 },
  { path: "/stats", priority: 0.8 },
  { path: "/draws", priority: 0.8 },
];
```

다음으로 교체:

```ts
const ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/tarot", priority: 0.9 },
  { path: "/generate", priority: 0.8 },
  { path: "/stats", priority: 0.8 },
  { path: "/draws", priority: 0.8 },
];
```

- [ ] **Step 3: 타입체크 + 전체 프론트 테스트**

Run: `cd frontend && npx tsc --noEmit && npm test`
Expected: 에러 없음, 기존 테스트 전부 통과 (이 태스크는 새 테스트를 추가하지 않음 — React 컴포넌트라 Global Constraints 참고)

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/Nav.tsx frontend/app/sitemap.ts
git commit -m "Wire up /tarot route in nav and sitemap"
```

- [ ] **Step 5: 브라우저 수동 확인**

로컬 dev 서버(`cd frontend && npm run dev`)를 켜고:
1. `/` 접속 → 소개 페이지(히어로 "로타로", "타로 보러가기" 버튼, 기능 카드 3개) 표시 확인
2. "타로 보러가기" 버튼 또는 "타로 운세" 카드 클릭 → `/tarot`로 이동, 기존 타로 페이지가 정상 렌더링(카드 선택 화면 등)되는지 확인
3. "번호 생성" 카드 → `/generate`, "통계 & 회차조회" 카드 → `/stats`로 정확히 이동하는지 확인
4. Nav에서 "홈"과 "타로"가 각각 `/`, `/tarot`에서 올바르게 활성(하이라이트) 표시되는지 확인
5. 콘솔 에러 없는지 확인
