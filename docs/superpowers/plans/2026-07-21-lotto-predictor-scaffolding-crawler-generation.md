> **[중단됨]** 이 계획은 Next.js 단일 프로젝트(TypeScript API 라우트 + Supabase JS 클라이언트) 아키텍처를 전제로 작성되었으나, 백엔드를 Java/Spring Boot로 분리하기로 설계가 바뀌면서 더 이상 유효하지 않다. Task 1(프로젝트 스캐폴딩)만 실행됐고, 이후 저장소가 `frontend/`로 재구성되며 정리되었다. 최신 설계는 [2026-07-21-lotto-predictor-java-backend-mvp-design.md](../specs/2026-07-21-lotto-predictor-java-backend-mvp-design.md) 참고, 새 구현 계획은 `docs/superpowers/plans/`에 별도로 작성된다.

# 로또 예측 웹앱 — 스캐폴딩 · Supabase 세팅 · 크롤러 · 번호생성 로직 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `D:\LottoPredictor`에 Next.js(TypeScript) + Supabase 프로젝트를 초기화하고, 동행복권 회차 데이터를 수집하는 크롤러와 출현 빈도 기반 가중 랜덤 번호 생성 로직을 API 라우트로 제공한다.

**Architecture:** Next.js App Router 단일 프로젝트. `lib/lotto/*`에 순수 로직(가중 랜덤 샘플링, 빈도 계산, 크롤러 파서, 동기화 로직)을 두고 단위 테스트로 검증한다. `lib/supabase/client.ts` / `lib/lotto/db.ts`가 Supabase와의 얇은 연결부(glue) 역할을 하며, `app/api/generate`와 `app/api/cron/crawl` 라우트가 이를 조립한다.

**Tech Stack:** Next.js 14+ (TypeScript, App Router), Supabase (PostgreSQL, `@supabase/supabase-js`), Vitest(단위 테스트), Vercel Cron(`vercel.json`).

## 실행 방식 안내 (이 세션의 협업 방식)

사용자는 애플리케이션 로직 코드를 직접 타이핑하는 것을 선호한다. 이 계획을 실행할 때:
- **스캐폴딩/설정/반복 작업** (프로젝트 초기화 명령, 패키지 설치, config 파일, `.env.example`, SQL 마이그레이션 파일, `git commit` 등)은 Claude가 직접 명령어/파일 생성으로 처리한다.
- **애플리케이션 로직 코드** (`lib/lotto/*.ts`, `lib/supabase/client.ts`, `app/api/**/route.ts`와 그 테스트 파일)는 Claude가 채팅에 코드 블록으로 제시하고, 사용자가 직접 타이핑해서 파일을 만든다. Claude는 그 다음에 테스트/빌드 명령을 실행해 검증한다.
- 각 Task의 Step에 `[스캐폴딩 — Claude 실행]` 또는 `[로직 코드 — 사용자 타이핑]` 태그를 붙여 구분한다.
- Supabase 프로젝트 생성, Vercel 배포/환경변수 등록 등 **계정이 필요한 작업**은 Claude가 대신할 수 없으므로, 안내만 하고 사용자가 직접 수행한다.

## Global Constraints

- DB는 PostgreSQL(Supabase), 테이블은 `lotto_draws` 하나로 시작하며 `draw_no`가 기본키(유니크)다 — upsert로 중복 저장을 방지한다.
- 크롤러는 동행복권이 공개하는 `getLottoNumber` 조회 API를 사용한다 (HTML 스크래핑 금지).
- 크롤러는 DB의 최신 회차 다음부터 순서대로 요청하며, 개별 회차 실패는 건너뛰고 로그만 남긴다 — 크롤러 전체가 중단되지 않고 다음 실행 때 재시도된다.
- `/api/cron/crawl`은 Vercel Cron 외 경로로 호출되지 않도록 시크릿 헤더로 보호한다.
- 번호 생성은 출현 빈도 가중치를 사용한 비복원 가중 랜덤 샘플링이 기본이며, 가중치 없는 "완전 랜덤" 모드를 옵션으로 제공한다.
- DB가 비어있으면(최초 배포 직후 등) 번호 생성은 자동으로 완전 랜덤 모드로 폴백한다.
- 가중 랜덤 로직은 특정 번호에 가중치를 높였을 때 실제로 더 자주 뽑히는지 단위 테스트로 검증한다.
- 크롤러 파서는 동행복권 API 응답을 모킹해 정상/비정상 응답 케이스를 테스트한다.
- 프론트엔드 E2E 테스트, 회원가입/결제/광고/연금복권/타로점 기능은 이 단계 범위에서 제외한다.
- UI 문구는 "예측"이 아니라 "통계 기반 추천" 등으로 표현한다 (이번 계획은 API/로직만 다루지만, 다음 단계 프론트엔드 계획에서 지켜야 할 제약으로 기록해 둔다).

**이 계획의 범위 밖:** `/api/stats`, `/api/draws`, 홈/통계/회차조회 프론트엔드 페이지, Vercel 실제 배포. 이들은 이 계획 완료 후 별도 계획으로 다룬다.

---

## File Structure

```
D:\LottoPredictor\
├── app/
│   └── api/
│       ├── generate/route.ts       # 번호 생성 API (얇은 glue)
│       └── cron/crawl/route.ts     # 크롤러 동기화 트리거 API (얇은 glue)
├── lib/
│   ├── supabase/
│   │   └── client.ts               # Supabase 클라이언트 팩토리
│   └── lotto/
│       ├── weightedRandom.ts       # 가중/균등 비복원 샘플링 (순수 함수)
│       ├── weightedRandom.test.ts
│       ├── frequency.ts            # 출현 빈도 계산 (순수 함수)
│       ├── frequency.test.ts
│       ├── generate.ts             # 번호 생성 통합 로직 (순수 함수, 폴백 포함)
│       ├── generate.test.ts
│       ├── crawler.ts              # 동행복권 API 호출 + 파싱
│       ├── crawler.test.ts
│       ├── sync.ts                 # 순차 동기화 루프 (의존성 주입, 순수 로직)
│       ├── sync.test.ts
│       └── db.ts                   # Supabase 읽기/upsert (얇은 glue, 테스트 없음)
├── db/
│   └── migrations/
│       └── 0001_create_lotto_draws.sql
├── .env.example
├── vercel.json
├── vitest.config.ts
├── package.json
└── tsconfig.json
```

---

## Task 1: 프로젝트 스캐폴딩 (Next.js + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.*`, `app/` 기본 구조 (create-next-app 생성)
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `npm test`, `npm run test:watch` 스크립트. 이후 모든 Task가 이 스크립트로 검증한다.

- [ ] **Step 1: `[스캐폴딩 — Claude 실행]` Next.js 앱 생성**

```bash
npx create-next-app@latest . --typescript --eslint --app --no-src-dir --import-alias "@/*" --no-tailwind --use-npm
```

기존 `docs/` 폴더가 있어도 충돌 없이 생성된다 (create-next-app은 빈 파일만 있는 디렉터리를 허용).

- [ ] **Step 2: 생성된 구조 확인**

Run: `ls`
Expected: `app/`, `package.json`, `tsconfig.json`, `next.config.*`, `.gitignore` 등이 보인다.

- [ ] **Step 3: `[스캐폴딩 — Claude 실행]` Vitest 설치**

```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 4: `[스캐폴딩 — Claude 실행]` `vitest.config.ts` 생성**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: `[스캐폴딩 — Claude 실행]` `package.json`에 테스트 스크립트 추가**

`"scripts"` 항목에 다음 두 줄을 추가한다:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: 테스트 러너가 동작하는지 확인 (테스트가 없어도 에러 없이 끝나야 함)**

Run: `npm test`
Expected: `No test files found` 메시지와 함께 종료 코드 0 (에러 없음).

- [ ] **Step 7: 커밋**

```bash
git add package.json package-lock.json tsconfig.json next.config.* app .gitignore vitest.config.ts eslint.config.* next-env.d.ts
git commit -m "chore: scaffold Next.js project with Vitest"
```

---

## Task 2: Supabase 설정 및 DB 스키마

**Files:**
- Create: `db/migrations/0001_create_lotto_draws.sql`
- Create: `.env.example`
- Create: `lib/supabase/client.ts` (로직 코드)

**Interfaces:**
- Produces: `getSupabaseClient(): SupabaseClient` — Task 6, 9에서 사용.
- Consumes: 환경변수 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: `[스캐폴딩 — Claude 실행]` 마이그레이션 SQL 파일 생성**

```sql
create table if not exists lotto_draws (
  draw_no integer primary key,
  draw_date date not null,
  num1 smallint not null,
  num2 smallint not null,
  num3 smallint not null,
  num4 smallint not null,
  num5 smallint not null,
  num6 smallint not null,
  bonus_num smallint not null,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: 사용자 수동 작업 — Supabase 프로젝트 생성 및 마이그레이션 실행**

Claude는 계정을 생성할 수 없으므로 다음을 사용자가 직접 수행한다:
1. https://supabase.com 에서 새 프로젝트 생성 (무료 티어).
2. Supabase 대시보드 → SQL Editor에서 `db/migrations/0001_create_lotto_draws.sql` 내용을 실행.
3. 대시보드 → Project Settings → API에서 `Project URL`과 `service_role` 키를 확인해 둔다 (다음 Step에서 사용, 절대 커밋하지 않는다).

- [ ] **Step 3: `[스캐폴딩 — Claude 실행]` `.env.example` 생성**

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

- [ ] **Step 4: 사용자 수동 작업 — 로컬 환경변수 설정**

`.env.example`을 `.env.local`로 복사하고, Step 2에서 확인한 값과 임의의 랜덤 문자열(`CRON_SECRET`)을 채워 넣는다. `.env.local`은 create-next-app이 만든 `.gitignore`에 이미 포함되어 있어 커밋되지 않는다.

- [ ] **Step 5: `[로직 코드 — 사용자 타이핑]` `lib/supabase/client.ts`**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  client = createClient(url, key);
  return client;
}
```

- [ ] **Step 6: `[스캐폴딩 — Claude 실행]` Supabase 패키지 설치**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 7: 타입 체크로 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add db/migrations/0001_create_lotto_draws.sql .env.example lib/supabase/client.ts package.json package-lock.json
git commit -m "feat: add Supabase client and lotto_draws migration"
```

---

## Task 3: 가중/균등 비복원 랜덤 샘플링 로직

**Files:**
- Create: `lib/lotto/weightedRandom.ts` (로직 코드)
- Test: `lib/lotto/weightedRandom.test.ts` (로직 코드)

**Interfaces:**
- Produces:
  - `interface NumberWeight { number: number; weight: number }`
  - `weightedSampleWithoutReplacement(weights: NumberWeight[], count: number, rng?: () => number): number[]`
  - `uniformSampleWithoutReplacement(count: number, max: number, rng?: () => number): number[]`
- Task 4, 5에서 `NumberWeight`를 사용한다.

- [ ] **Step 1: `[로직 코드 — 사용자 타이핑]` 실패하는 테스트 작성 — `lib/lotto/weightedRandom.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { weightedSampleWithoutReplacement, uniformSampleWithoutReplacement, NumberWeight } from './weightedRandom';

describe('uniformSampleWithoutReplacement', () => {
  it('returns 6 distinct numbers between 1 and 45', () => {
    const result = uniformSampleWithoutReplacement(6, 45);
    expect(result).toHaveLength(6);
    expect(new Set(result).size).toBe(6);
    for (const n of result) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(45);
    }
  });

  it('is deterministic given a fixed rng sequence', () => {
    const rng = () => 0;
    const result = uniformSampleWithoutReplacement(6, 45, rng);
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('weightedSampleWithoutReplacement', () => {
  it('returns 6 distinct numbers from the given weights', () => {
    const weights: NumberWeight[] = Array.from({ length: 45 }, (_, i) => ({ number: i + 1, weight: 1 }));
    const result = weightedSampleWithoutReplacement(weights, 6);
    expect(result).toHaveLength(6);
    expect(new Set(result).size).toBe(6);
  });

  it('picks a heavily-weighted number far more often than the rest', () => {
    const weights: NumberWeight[] = Array.from({ length: 45 }, (_, i) => ({
      number: i + 1,
      weight: i + 1 === 7 ? 1000 : 1,
    }));
    let countOf7 = 0;
    const trials = 500;
    for (let t = 0; t < trials; t++) {
      const result = weightedSampleWithoutReplacement(weights, 6);
      if (result.includes(7)) countOf7++;
    }
    // Baseline (equal weights) chance of one number appearing in a 6-of-45 draw is ~13%.
    // A 1000x weight should push this near 100%.
    expect(countOf7 / trials).toBeGreaterThan(0.9);
  });

  it('falls back to a uniform pick when all remaining weights are zero', () => {
    const weights: NumberWeight[] = Array.from({ length: 45 }, (_, i) => ({ number: i + 1, weight: 0 }));
    const result = weightedSampleWithoutReplacement(weights, 6);
    expect(result).toHaveLength(6);
    expect(new Set(result).size).toBe(6);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/lotto/weightedRandom.test.ts`
Expected: FAIL — `Cannot find module './weightedRandom'`

- [ ] **Step 3: `[로직 코드 — 사용자 타이핑]` 구현 — `lib/lotto/weightedRandom.ts`**

```typescript
export interface NumberWeight {
  number: number;
  weight: number;
}

export function weightedSampleWithoutReplacement(
  weights: NumberWeight[],
  count: number,
  rng: () => number = Math.random
): number[] {
  const pool = weights.map((w) => ({ ...w }));
  const picked: number[] = [];

  for (let i = 0; i < count; i++) {
    const totalWeight = pool.reduce((sum, w) => sum + w.weight, 0);

    let idx: number;
    if (totalWeight <= 0) {
      idx = Math.floor(rng() * pool.length);
    } else {
      let r = rng() * totalWeight;
      idx = 0;
      for (; idx < pool.length; idx++) {
        r -= pool[idx].weight;
        if (r <= 0) break;
      }
      idx = Math.min(idx, pool.length - 1);
    }

    picked.push(pool[idx].number);
    pool.splice(idx, 1);
  }

  return picked;
}

export function uniformSampleWithoutReplacement(
  count: number,
  max: number,
  rng: () => number = Math.random
): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  const picked: number[] = [];

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return picked;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/lotto/weightedRandom.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/lotto/weightedRandom.ts lib/lotto/weightedRandom.test.ts
git commit -m "feat: add weighted and uniform sampling without replacement"
```

---

## Task 4: 출현 빈도 계산 로직

**Files:**
- Create: `lib/lotto/frequency.ts` (로직 코드)
- Test: `lib/lotto/frequency.test.ts` (로직 코드)

**Interfaces:**
- Consumes: `NumberWeight` from `./weightedRandom` (Task 3).
- Produces:
  - `interface DrawRecord { numbers: [number, number, number, number, number, number] }`
  - `calculateFrequency(draws: DrawRecord[]): NumberWeight[]`
- Task 5에서 `DrawRecord`와 `calculateFrequency`를 사용한다.

- [ ] **Step 1: `[로직 코드 — 사용자 타이핑]` 실패하는 테스트 작성 — `lib/lotto/frequency.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateFrequency, DrawRecord } from './frequency';

describe('calculateFrequency', () => {
  it('returns weight 0 for every number when there are no draws', () => {
    const result = calculateFrequency([]);
    expect(result).toHaveLength(45);
    expect(result.every((w) => w.weight === 0)).toBe(true);
  });

  it('counts how many times each number appears across draws', () => {
    const draws: DrawRecord[] = [
      { numbers: [1, 2, 3, 4, 5, 6] },
      { numbers: [1, 2, 3, 7, 8, 9] },
    ];
    const result = calculateFrequency(draws);
    const weightOf = (n: number) => result.find((w) => w.number === n)?.weight;

    expect(weightOf(1)).toBe(2);
    expect(weightOf(2)).toBe(2);
    expect(weightOf(3)).toBe(2);
    expect(weightOf(4)).toBe(1);
    expect(weightOf(10)).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/lotto/frequency.test.ts`
Expected: FAIL — `Cannot find module './frequency'`

- [ ] **Step 3: `[로직 코드 — 사용자 타이핑]` 구현 — `lib/lotto/frequency.ts`**

```typescript
import { NumberWeight } from './weightedRandom';

export interface DrawRecord {
  numbers: [number, number, number, number, number, number];
}

export function calculateFrequency(draws: DrawRecord[]): NumberWeight[] {
  const counts = new Array(45).fill(0);

  for (const draw of draws) {
    for (const n of draw.numbers) {
      counts[n - 1]++;
    }
  }

  return counts.map((weight, i) => ({ number: i + 1, weight }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/lotto/frequency.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/lotto/frequency.ts lib/lotto/frequency.test.ts
git commit -m "feat: add draw frequency calculation"
```

---

## Task 5: 번호 생성 통합 로직 (폴백 포함)

**Files:**
- Create: `lib/lotto/generate.ts` (로직 코드)
- Test: `lib/lotto/generate.test.ts` (로직 코드)

**Interfaces:**
- Consumes: `NumberWeight`, `weightedSampleWithoutReplacement`, `uniformSampleWithoutReplacement` from `./weightedRandom` (Task 3); `DrawRecord`, `calculateFrequency` from `./frequency` (Task 4).
- Produces:
  - `interface GenerateOptions { mode: 'weighted' | 'random'; sets: number; draws: DrawRecord[]; rng?: () => number }`
  - `interface GenerateResult { mode: 'weighted' | 'random'; results: number[][] }`
  - `generateNumberSets(options: GenerateOptions): GenerateResult`
- Task 6(`/api/generate` 라우트)에서 `generateNumberSets`를 사용한다.

- [ ] **Step 1: `[로직 코드 — 사용자 타이핑]` 실패하는 테스트 작성 — `lib/lotto/generate.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateNumberSets } from './generate';
import { DrawRecord } from './frequency';

describe('generateNumberSets', () => {
  it('falls back to random mode when there are no draws, even if weighted is requested', () => {
    const result = generateNumberSets({ mode: 'weighted', sets: 1, draws: [] });
    expect(result.mode).toBe('random');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toHaveLength(6);
  });

  it('uses weighted mode when draws exist and weighted is requested', () => {
    const draws: DrawRecord[] = [{ numbers: [1, 2, 3, 4, 5, 6] }];
    const result = generateNumberSets({ mode: 'weighted', sets: 1, draws });
    expect(result.mode).toBe('weighted');
  });

  it('generates the requested number of sets, each sorted ascending', () => {
    const result = generateNumberSets({ mode: 'random', sets: 3, draws: [] });
    expect(result.results).toHaveLength(3);
    for (const set of result.results) {
      expect(set).toEqual([...set].sort((a, b) => a - b));
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/lotto/generate.test.ts`
Expected: FAIL — `Cannot find module './generate'`

- [ ] **Step 3: `[로직 코드 — 사용자 타이핑]` 구현 — `lib/lotto/generate.ts`**

```typescript
import { weightedSampleWithoutReplacement, uniformSampleWithoutReplacement } from './weightedRandom';
import { calculateFrequency, DrawRecord } from './frequency';

export interface GenerateOptions {
  mode: 'weighted' | 'random';
  sets: number;
  draws: DrawRecord[];
  rng?: () => number;
}

export interface GenerateResult {
  mode: 'weighted' | 'random';
  results: number[][];
}

export function generateNumberSets(options: GenerateOptions): GenerateResult {
  const { sets, draws, rng = Math.random } = options;
  const useWeighted = options.mode === 'weighted' && draws.length > 0;
  const weights = useWeighted ? calculateFrequency(draws) : null;

  const results = Array.from({ length: sets }, () => {
    const numbers =
      useWeighted && weights
        ? weightedSampleWithoutReplacement(weights, 6, rng)
        : uniformSampleWithoutReplacement(6, 45, rng);
    return numbers.sort((a, b) => a - b);
  });

  return { mode: useWeighted ? 'weighted' : 'random', results };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/lotto/generate.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/lotto/generate.ts lib/lotto/generate.test.ts
git commit -m "feat: add generateNumberSets with random fallback on empty data"
```

---

## Task 6: `/api/generate` 라우트

**Files:**
- Create: `app/api/generate/route.ts` (로직 코드, 테스트 없음 — 얇은 glue)

**Interfaces:**
- Consumes: `getSupabaseClient` from `@/lib/supabase/client` (Task 2); `generateNumberSets` from `@/lib/lotto/generate` (Task 5).
- Produces: `GET /api/generate?mode=weighted|random&sets=1..10` → `{ mode, results }`

- [ ] **Step 1: `[로직 코드 — 사용자 타이핑]` 구현 — `app/api/generate/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';
import { generateNumberSets } from '@/lib/lotto/generate';

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode') === 'random' ? 'random' : 'weighted';
  const setsParam = request.nextUrl.searchParams.get('sets');
  const sets = Math.min(Math.max(parseInt(setsParam ?? '1', 10) || 1, 1), 10);

  const supabase = getSupabaseClient();
  const { data: draws, error } = await supabase
    .from('lotto_draws')
    .select('num1,num2,num3,num4,num5,num6');

  if (error) {
    return NextResponse.json({ error: 'failed to load draws' }, { status: 500 });
  }

  const result = generateNumberSets({
    mode,
    sets,
    draws: (draws ?? []).map((d) => ({
      numbers: [d.num1, d.num2, d.num3, d.num4, d.num5, d.num6],
    })),
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 개발 서버로 수동 검증**

Run: `npm run dev` (백그라운드로 실행)

다른 터미널에서:
```bash
curl "http://localhost:3000/api/generate?mode=random&sets=2"
```
Expected: `{"mode":"random","results":[[...6개 숫자],[...6개 숫자]]}` — DB가 아직 비어있으므로 `weighted` 요청이어도 `random`으로 폴백되는 것도 함께 확인한다:
```bash
curl "http://localhost:3000/api/generate?mode=weighted&sets=1"
```
Expected: `"mode":"random"` (Task 2에서 만든 테이블이 비어있기 때문).

- [ ] **Step 4: 커밋**

```bash
git add app/api/generate/route.ts
git commit -m "feat: add /api/generate route"
```

---

## Task 7: 동행복권 크롤러 파서

**Files:**
- Create: `lib/lotto/crawler.ts` (로직 코드)
- Test: `lib/lotto/crawler.test.ts` (로직 코드)

**Interfaces:**
- Produces:
  - `interface LottoDraw { drawNo: number; drawDate: string; numbers: [number,number,number,number,number,number]; bonusNumber: number }`
  - `type FetchDrawResult = { status: 'success'; draw: LottoDraw } | { status: 'not-drawn-yet' } | { status: 'error'; message: string }`
  - `parseDrawResponse(data: unknown): LottoDraw | null`
  - `fetchDraw(drawNo: number, fetchImpl?: typeof fetch): Promise<FetchDrawResult>`
- Task 8(`sync.ts`), Task 9(`db.ts`)에서 `LottoDraw`와 `FetchDrawResult`를 사용한다.

- [ ] **Step 1: `[로직 코드 — 사용자 타이핑]` 실패하는 테스트 작성 — `lib/lotto/crawler.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchDraw, parseDrawResponse } from './crawler';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

describe('parseDrawResponse', () => {
  it('parses a successful response into a LottoDraw', () => {
    const draw = parseDrawResponse({
      returnValue: 'success',
      drwNo: 1050,
      drwNoDate: '2023-01-07',
      drwtNo1: 1,
      drwtNo2: 7,
      drwtNo3: 13,
      drwtNo4: 22,
      drwtNo5: 31,
      drwtNo6: 45,
      bnusNo: 10,
    });
    expect(draw).toEqual({
      drawNo: 1050,
      drawDate: '2023-01-07',
      numbers: [1, 7, 13, 22, 31, 45],
      bonusNumber: 10,
    });
  });

  it('returns null when returnValue is fail', () => {
    expect(parseDrawResponse({ returnValue: 'fail' })).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    expect(parseDrawResponse({ returnValue: 'success', drwNo: 1050 })).toBeNull();
  });
});

describe('fetchDraw', () => {
  const validBody = {
    returnValue: 'success',
    drwNo: 1050,
    drwNoDate: '2023-01-07',
    drwtNo1: 1,
    drwtNo2: 7,
    drwtNo3: 13,
    drwtNo4: 22,
    drwtNo5: 31,
    drwtNo6: 45,
    bnusNo: 10,
  };

  it('returns a success result for a valid draw', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(validBody));
    const result = await fetchDraw(1050, fetchImpl);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.draw.drawNo).toBe(1050);
    }
  });

  it('returns a not-drawn-yet result when the API reports fail', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ returnValue: 'fail' }));
    const result = await fetchDraw(99999, fetchImpl);
    expect(result.status).toBe('not-drawn-yet');
  });

  it('returns an error result on HTTP failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false));
    const result = await fetchDraw(1050, fetchImpl);
    expect(result.status).toBe('error');
  });

  it('returns an error result when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await fetchDraw(1050, fetchImpl);
    expect(result.status).toBe('error');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/lotto/crawler.test.ts`
Expected: FAIL — `Cannot find module './crawler'`

- [ ] **Step 3: `[로직 코드 — 사용자 타이핑]` 구현 — `lib/lotto/crawler.ts`**

```typescript
export interface LottoDraw {
  drawNo: number;
  drawDate: string;
  numbers: [number, number, number, number, number, number];
  bonusNumber: number;
}

export type FetchDrawResult =
  | { status: 'success'; draw: LottoDraw }
  | { status: 'not-drawn-yet' }
  | { status: 'error'; message: string };

interface DhLotteryApiResponse {
  returnValue?: string;
  drwNo?: number;
  drwNoDate?: string;
  drwtNo1?: number;
  drwtNo2?: number;
  drwtNo3?: number;
  drwtNo4?: number;
  drwtNo5?: number;
  drwtNo6?: number;
  bnusNo?: number;
}

export function parseDrawResponse(data: DhLotteryApiResponse): LottoDraw | null {
  if (data.returnValue !== 'success') return null;
  if (
    data.drwNo == null ||
    data.drwNoDate == null ||
    data.drwtNo1 == null ||
    data.drwtNo2 == null ||
    data.drwtNo3 == null ||
    data.drwtNo4 == null ||
    data.drwtNo5 == null ||
    data.drwtNo6 == null ||
    data.bnusNo == null
  ) {
    return null;
  }

  return {
    drawNo: data.drwNo,
    drawDate: data.drwNoDate,
    numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
    bonusNumber: data.bnusNo,
  };
}

export async function fetchDraw(
  drawNo: number,
  fetchImpl: typeof fetch = fetch
): Promise<FetchDrawResult> {
  let res: Response;
  try {
    res = await fetchImpl(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drawNo}`);
  } catch (err) {
    return { status: 'error', message: `network error: ${(err as Error).message}` };
  }

  if (!res.ok) {
    return { status: 'error', message: `http ${res.status}` };
  }

  let data: DhLotteryApiResponse;
  try {
    data = (await res.json()) as DhLotteryApiResponse;
  } catch (err) {
    return { status: 'error', message: `invalid json: ${(err as Error).message}` };
  }

  const draw = parseDrawResponse(data);
  if (draw === null) {
    if (data.returnValue === 'fail') return { status: 'not-drawn-yet' };
    return { status: 'error', message: 'unexpected response shape' };
  }

  return { status: 'success', draw };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/lotto/crawler.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/lotto/crawler.ts lib/lotto/crawler.test.ts
git commit -m "feat: add dhlottery crawler fetch and parser"
```

---

## Task 8: 동기화(sync) 로직

**Files:**
- Create: `lib/lotto/sync.ts` (로직 코드)
- Test: `lib/lotto/sync.test.ts` (로직 코드)

**Interfaces:**
- Consumes: `LottoDraw`, `FetchDrawResult` from `./crawler` (Task 7).
- Produces:
  - `interface SyncResult { synced: number[]; skipped: { drawNo: number; reason: string }[] }`
  - `syncDraws(deps: { getLatestDrawNo: () => Promise<number>; fetchDraw: (drawNo: number) => Promise<FetchDrawResult>; upsertDraw: (draw: LottoDraw) => Promise<void>; maxAttempts?: number }): Promise<SyncResult>`
- Task 10(`/api/cron/crawl` 라우트)에서 `syncDraws`를 사용한다.

- [ ] **Step 1: `[로직 코드 — 사용자 타이핑]` 실패하는 테스트 작성 — `lib/lotto/sync.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { syncDraws } from './sync';
import type { LottoDraw, FetchDrawResult } from './crawler';

function makeDraw(drawNo: number): LottoDraw {
  return { drawNo, drawDate: '2023-01-07', numbers: [1, 2, 3, 4, 5, 6], bonusNumber: 7 };
}

describe('syncDraws', () => {
  it('fetches sequentially from latest+1 until not-drawn-yet, then stops', async () => {
    const fetchDraw = vi.fn(async (drawNo: number): Promise<FetchDrawResult> => {
      if (drawNo <= 1052) return { status: 'success', draw: makeDraw(drawNo) };
      return { status: 'not-drawn-yet' };
    });
    const upsertDraw = vi.fn().mockResolvedValue(undefined);

    const result = await syncDraws({
      getLatestDrawNo: async () => 1050,
      fetchDraw,
      upsertDraw,
    });

    expect(result.synced).toEqual([1051, 1052]);
    expect(result.skipped).toEqual([]);
    expect(upsertDraw).toHaveBeenCalledTimes(2);
  });

  it('logs a skip and continues past a draw that errors', async () => {
    const fetchDraw = vi.fn(async (drawNo: number): Promise<FetchDrawResult> => {
      if (drawNo === 1051) return { status: 'error', message: 'network blip' };
      if (drawNo === 1052) return { status: 'success', draw: makeDraw(drawNo) };
      return { status: 'not-drawn-yet' };
    });
    const upsertDraw = vi.fn().mockResolvedValue(undefined);

    const result = await syncDraws({
      getLatestDrawNo: async () => 1050,
      fetchDraw,
      upsertDraw,
    });

    expect(result.synced).toEqual([1052]);
    expect(result.skipped).toEqual([{ drawNo: 1051, reason: 'network blip' }]);
  });

  it('stops after maxAttempts to avoid an unbounded loop', async () => {
    const fetchDraw = vi.fn(async (): Promise<FetchDrawResult> => ({
      status: 'error',
      message: 'always fails',
    }));
    const upsertDraw = vi.fn().mockResolvedValue(undefined);

    const result = await syncDraws({
      getLatestDrawNo: async () => 0,
      fetchDraw,
      upsertDraw,
      maxAttempts: 5,
    });

    expect(result.skipped).toHaveLength(5);
    expect(fetchDraw).toHaveBeenCalledTimes(5);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run lib/lotto/sync.test.ts`
Expected: FAIL — `Cannot find module './sync'`

- [ ] **Step 3: `[로직 코드 — 사용자 타이핑]` 구현 — `lib/lotto/sync.ts`**

```typescript
import type { LottoDraw, FetchDrawResult } from './crawler';

export interface SyncResult {
  synced: number[];
  skipped: { drawNo: number; reason: string }[];
}

export async function syncDraws(deps: {
  getLatestDrawNo: () => Promise<number>;
  fetchDraw: (drawNo: number) => Promise<FetchDrawResult>;
  upsertDraw: (draw: LottoDraw) => Promise<void>;
  maxAttempts?: number;
}): Promise<SyncResult> {
  const latest = await deps.getLatestDrawNo();
  const maxAttempts = deps.maxAttempts ?? 200;

  const synced: number[] = [];
  const skipped: { drawNo: number; reason: string }[] = [];

  let drawNo = latest + 1;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    const result = await deps.fetchDraw(drawNo);

    if (result.status === 'not-drawn-yet') break;

    if (result.status === 'error') {
      skipped.push({ drawNo, reason: result.message });
      drawNo++;
      continue;
    }

    await deps.upsertDraw(result.draw);
    synced.push(drawNo);
    drawNo++;
  }

  return { synced, skipped };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/lotto/sync.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/lotto/sync.ts lib/lotto/sync.test.ts
git commit -m "feat: add sequential draw sync loop with per-draw skip on error"
```

---

## Task 9: Supabase DB 접근 함수

**Files:**
- Create: `lib/lotto/db.ts` (로직 코드, 테스트 없음 — 얇은 glue, Task 10에서 수동 검증)

**Interfaces:**
- Consumes: `LottoDraw` from `./crawler` (Task 7); `SupabaseClient` from `@supabase/supabase-js`.
- Produces:
  - `getLatestDrawNo(supabase: SupabaseClient): Promise<number>`
  - `upsertDraw(supabase: SupabaseClient, draw: LottoDraw): Promise<void>`
- Task 10(`/api/cron/crawl` 라우트)에서 두 함수를 `syncDraws`에 주입한다.

- [ ] **Step 1: `[로직 코드 — 사용자 타이핑]` 구현 — `lib/lotto/db.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import type { LottoDraw } from './crawler';

export async function getLatestDrawNo(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('lotto_draws')
    .select('draw_no')
    .order('draw_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`failed to read latest draw_no: ${error.message}`);
  return data?.draw_no ?? 0;
}

export async function upsertDraw(supabase: SupabaseClient, draw: LottoDraw): Promise<void> {
  const { error } = await supabase.from('lotto_draws').upsert({
    draw_no: draw.drawNo,
    draw_date: draw.drawDate,
    num1: draw.numbers[0],
    num2: draw.numbers[1],
    num3: draw.numbers[2],
    num4: draw.numbers[3],
    num5: draw.numbers[4],
    num6: draw.numbers[5],
    bonus_num: draw.bonusNumber,
  });

  if (error) throw new Error(`failed to upsert draw ${draw.drawNo}: ${error.message}`);
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add lib/lotto/db.ts
git commit -m "feat: add Supabase read/upsert helpers for lotto_draws"
```

---

## Task 10: `/api/cron/crawl` 라우트 + Vercel Cron 설정

**Files:**
- Create: `app/api/cron/crawl/route.ts` (로직 코드, 테스트 없음 — 얇은 glue)
- Create: `vercel.json` (스캐폴딩)

**Interfaces:**
- Consumes: `getSupabaseClient` (Task 2), `fetchDraw` (Task 7), `syncDraws` (Task 8), `getLatestDrawNo`/`upsertDraw` (Task 9).
- Produces: `GET /api/cron/crawl` (Authorization 헤더로 보호) → `SyncResult` JSON.

- [ ] **Step 1: `[로직 코드 — 사용자 타이핑]` 구현 — `app/api/cron/crawl/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fetchDraw } from '@/lib/lotto/crawler';
import { getLatestDrawNo, upsertDraw } from '@/lib/lotto/db';
import { syncDraws } from '@/lib/lotto/sync';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  const result = await syncDraws({
    getLatestDrawNo: () => getLatestDrawNo(supabase),
    fetchDraw: (drawNo) => fetchDraw(drawNo),
    upsertDraw: (draw) => upsertDraw(supabase, draw),
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 2: `[스캐폴딩 — Claude 실행]` `vercel.json` 생성**

Vercel Cron 스케줄은 UTC 기준이다. 로또 추첨은 매주 토요일 20:45 KST경이므로, 여유를 두고 21:30 KST(=UTC 12:30, 같은 토요일)에 실행하도록 설정한다.

```json
{
  "crons": [
    {
      "path": "/api/cron/crawl",
      "schedule": "30 12 * * 6"
    }
  ]
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 개발 서버로 수동 검증 (시크릿 보호 확인)**

Run: `npm run dev` (백그라운드로 실행, 아직 실행 중이 아니라면)

```bash
curl -i "http://localhost:3000/api/cron/crawl"
```
Expected: `401 Unauthorized`

```bash
curl -i -H "Authorization: Bearer <.env.local의 CRON_SECRET 값>" "http://localhost:3000/api/cron/crawl"
```
Expected: `200 OK`, `{"synced":[...],"skipped":[...]}` — 최초 실행이면 1회차부터 백필을 시작하므로 시간이 걸릴 수 있다. 응답의 `synced` 배열에 회차 번호들이 쌓이는지, Supabase 대시보드의 `lotto_draws` 테이블에 실제로 행이 쌓이는지 확인한다.

- [ ] **Step 5: 사용자 수동 작업 — Vercel 배포 시 환경변수 등록 (이 단계에서는 필수 아님, 참고용)**

실제 배포 시 Vercel 프로젝트 설정 → Environment Variables에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`을 등록해야 Cron이 정상 동작한다. 배포 자체는 이 계획의 범위 밖이므로 별도 계획/요청 시 진행한다.

- [ ] **Step 6: 커밋**

```bash
git add app/api/cron/crawl/route.ts vercel.json
git commit -m "feat: add /api/cron/crawl route with secret-protected sync trigger"
```

---

## 완료 후 확인

- [ ] **전체 테스트 스위트 실행**

Run: `npm test`
Expected: 모든 테스트(weightedRandom 4개, frequency 2개, generate 3개, crawler 7개, sync 3개 = 총 19개) PASS.

- [ ] **전체 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

이 계획이 끝나면 크롤러·DB·번호생성 API가 로컬에서 동작하는 상태가 된다. 다음 단계는 별도 계획으로: `/api/stats`, `/api/draws` API와 홈/통계/회차조회 프론트엔드 페이지, 그리고 실제 Vercel 배포.
