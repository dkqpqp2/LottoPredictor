# 번호 저장 + 마이페이지 (2단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/generate`와 `/tarot`에서 나온 번호를 저장할 수 있게 하고, `/mypage`에서 저장된 번호를 월별/주별로 모아볼 수 있게 한다.

**Architecture:** 백엔드에 새 `savednumber` 패키지(엔티티/리포지토리/서비스/DTO)를 추가하고 `POST /api/saved-numbers`, `GET /api/saved-numbers` 두 엔드포인트를 노출한다. 대상 회차는 `WeeklyPickService`가 이미 쓰는 방식과 동일하게 `lottoDrawRepository.findMaxDrawNo() + 1`로 계산한다. 프론트는 `lib/savedNumbers.ts`(API 클라이언트)와 `lib/groupSavedNumbers.ts`(월별→주별 그룹핑 순수 함수)를 추가하고, `/generate`·`/tarot` 결과 카드에 저장 버튼을, `/mypage`에 조회 화면을 만든다.

**Tech Stack:** Spring Boot 4.1.0 (Java 21, Spring Data JPA), Next.js 16 App Router (TypeScript, CSS Modules), Vitest.

## Global Constraints

- 저장 가능한 소스는 `/generate`(번호생성)와 `/tarot`(타로) 두 곳. `source` 값은 문자열 `"GENERATE"` 또는 `"TAROT"`을 그대로 DB에 저장한다
- 대상 회차(`target_draw_no`)는 저장 시점 기준 `lottoDrawRepository.findMaxDrawNo().orElse(0) + 1`로 계산한다 (기존 `WeeklyPickService.generateAndSave`와 동일한 로직)
- 저장 개수 제한은 없다 (하루 생성 횟수 자체가 등급별로 이미 제한되어 있음)
- 서버는 중복 저장을 막지 않는다. 중복 방지는 프론트 UI 레벨(저장 성공 시 해당 카드 버튼을 "저장됨"으로 비활성화)에서만 처리한다
- `POST /api/saved-numbers`, `GET /api/saved-numbers` 모두 `@AuthPrincipal` 필수 (미로그인 401)
- `/mypage`는 저장일(`savedAt`) 기준 월별 → 그 안에서 주별(월요일 시작)로 그룹핑해서 최신순으로 보여준다. 로그인 안 됐으면 기존 페이지들과 동일한 패턴(안내 문구 + 카카오 로그인 버튼)을 보여준다
- `/mypage`는 로그인 필요 페이지이므로 `frontend/app/sitemap.ts`에 추가하지 않는다 (기존에도 `/collect`가 같은 이유로 빠져 있음)
- 컨트롤러는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 (전체 빌드 통과로 검증)
- 프론트 lib 파일은 상대경로 import 사용. React 컴포넌트(페이지)는 자동 테스트 없이 타입체크 + 브라우저 수동 확인 (기존 컨벤션). 순수 함수(`groupSavedNumbers`)는 유닛 테스트 작성

---

### Task 1: DB 마이그레이션 + `SavedNumber` 엔티티 + `SavedNumberRepository`

**Files:**
- Create: `db/migrations/0006_create_saved_numbers.sql`
- Create: `backend/src/main/java/com/lottopredictor/backend/savednumber/SavedNumber.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/savednumber/SavedNumberRepository.java`

**Interfaces:**
- Produces: `SavedNumber(Long userId, String source, Integer targetDrawNo, Integer num1, Integer num2, Integer num3, Integer num4, Integer num5, Integer num6, Instant savedAt)` 생성자, `getId()`, `getSource()`, `getTargetDrawNo()`, `getSavedAt()`, `numbers(): List<Integer>`. `SavedNumberRepository.findByUserIdOrderBySavedAtDesc(Long userId): List<SavedNumber>`

리포지토리/엔티티는 이 코드베이스 컨벤션상 직접 테스트하지 않는다 (기존 `WeeklyPick`/`DailyUsage`도 전용 테스트 없음). 이 태스크는 컴파일 확인으로 충분하다.

- [ ] **Step 1: `0006_create_saved_numbers.sql` 작성**

```sql
create table if not exists saved_numbers (
  id bigserial primary key,
  user_id bigint not null references users(id),
  source varchar(20) not null,
  target_draw_no integer not null,
  num1 integer not null,
  num2 integer not null,
  num3 integer not null,
  num4 integer not null,
  num5 integer not null,
  num6 integer not null,
  saved_at timestamptz not null default now()
);
```

- [ ] **Step 2: `SavedNumber` 엔티티 작성**

```java
package com.lottopredictor.backend.savednumber;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "saved_numbers")
public class SavedNumber {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "target_draw_no", nullable = false)
    private Integer targetDrawNo;

    @Column(name = "num1", nullable = false)
    private Integer num1;

    @Column(name = "num2", nullable = false)
    private Integer num2;

    @Column(name = "num3", nullable = false)
    private Integer num3;

    @Column(name = "num4", nullable = false)
    private Integer num4;

    @Column(name = "num5", nullable = false)
    private Integer num5;

    @Column(name = "num6", nullable = false)
    private Integer num6;

    @Column(name = "saved_at", nullable = false)
    private Instant savedAt;

    protected SavedNumber() {
    }

    public SavedNumber(
            Long userId,
            String source,
            Integer targetDrawNo,
            Integer num1,
            Integer num2,
            Integer num3,
            Integer num4,
            Integer num5,
            Integer num6,
            Instant savedAt
    ) {
        this.userId = userId;
        this.source = source;
        this.targetDrawNo = targetDrawNo;
        this.num1 = num1;
        this.num2 = num2;
        this.num3 = num3;
        this.num4 = num4;
        this.num5 = num5;
        this.num6 = num6;
        this.savedAt = savedAt;
    }

    public Long getId() {
        return id;
    }

    public String getSource() {
        return source;
    }

    public Integer getTargetDrawNo() {
        return targetDrawNo;
    }

    public Instant getSavedAt() {
        return savedAt;
    }

    public List<Integer> numbers() {
        return List.of(num1, num2, num3, num4, num5, num6);
    }
}
```

- [ ] **Step 3: `SavedNumberRepository` 작성**

```java
package com.lottopredictor.backend.savednumber;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavedNumberRepository extends JpaRepository<SavedNumber, Long> {

    List<SavedNumber> findByUserIdOrderBySavedAtDesc(Long userId);
}
```

- [ ] **Step 4: 전체 빌드 확인**

Run: `cd backend && ./gradlew build`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0006_create_saved_numbers.sql backend/src/main/java/com/lottopredictor/backend/savednumber/SavedNumber.java backend/src/main/java/com/lottopredictor/backend/savednumber/SavedNumberRepository.java
git commit -m "Add saved_numbers table, SavedNumber entity and repository"
```

---

### Task 2: DTO + `SavedNumberService`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/savednumber/SaveNumberRequest.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/savednumber/SavedNumberResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/savednumber/SavedNumberService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/savednumber/SavedNumberServiceTest.java`

**Interfaces:**
- Consumes: `SavedNumberRepository`(Task 1), `LottoDrawRepository.findMaxDrawNo(): Optional<Integer>`(기존, `com.lottopredictor.backend.draw` 패키지)
- Produces: `SaveNumberRequest(String source, List<Integer> numbers)`. `SavedNumberResponse(Long id, String source, int targetDrawNo, List<Integer> numbers, Instant savedAt)`. `SavedNumberService.save(Long userId, String source, List<Integer> numbers): SavedNumberResponse`, `SavedNumberService.getSaved(Long userId): List<SavedNumberResponse>`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.lottopredictor.backend.savednumber;

import com.lottopredictor.backend.draw.LottoDrawRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SavedNumberServiceTest {

    @Mock
    private SavedNumberRepository savedNumberRepository;

    @Mock
    private LottoDrawRepository lottoDrawRepository;

    @Test
    void saveComputesTheNextDrawNoAndPersistsTheNumbers() {
        when(lottoDrawRepository.findMaxDrawNo()).thenReturn(Optional.of(1180));
        when(savedNumberRepository.save(any(SavedNumber.class))).thenAnswer(inv -> inv.getArgument(0));

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        SavedNumberResponse response = service.save(1L, "GENERATE", List.of(1, 2, 3, 4, 5, 6));

        assertThat(response.source()).isEqualTo("GENERATE");
        assertThat(response.targetDrawNo()).isEqualTo(1181);
        assertThat(response.numbers()).containsExactly(1, 2, 3, 4, 5, 6);
    }

    @Test
    void saveDefaultsTheTargetDrawNoToOneWhenNoDrawsExistYet() {
        when(lottoDrawRepository.findMaxDrawNo()).thenReturn(Optional.empty());
        when(savedNumberRepository.save(any(SavedNumber.class))).thenAnswer(inv -> inv.getArgument(0));

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        SavedNumberResponse response = service.save(1L, "TAROT", List.of(10, 20, 30, 40, 41, 45));

        assertThat(response.targetDrawNo()).isEqualTo(1);
    }

    @Test
    void getSavedReturnsAllSavedNumbersForTheUserMostRecentFirst() {
        SavedNumber existing = new SavedNumber(1L, "GENERATE", 1181, 1, 2, 3, 4, 5, 6, Instant.now());
        when(savedNumberRepository.findByUserIdOrderBySavedAtDesc(1L)).thenReturn(List.of(existing));

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        List<SavedNumberResponse> result = service.getSaved(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).source()).isEqualTo("GENERATE");
        assertThat(result.get(0).numbers()).containsExactly(1, 2, 3, 4, 5, 6);
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.savednumber.SavedNumberServiceTest"`
Expected: FAIL (컴파일 에러 — `SaveNumberRequest`, `SavedNumberResponse`, `SavedNumberService`가 아직 없음)

- [ ] **Step 3: `SaveNumberRequest` 작성**

```java
package com.lottopredictor.backend.savednumber;

import java.util.List;

public record SaveNumberRequest(String source, List<Integer> numbers) {
}
```

- [ ] **Step 4: `SavedNumberResponse` 작성**

```java
package com.lottopredictor.backend.savednumber;

import java.time.Instant;
import java.util.List;

public record SavedNumberResponse(Long id, String source, int targetDrawNo, List<Integer> numbers, Instant savedAt) {
}
```

- [ ] **Step 5: `SavedNumberService` 작성**

```java
package com.lottopredictor.backend.savednumber;

import com.lottopredictor.backend.draw.LottoDrawRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class SavedNumberService {

    private final SavedNumberRepository savedNumberRepository;
    private final LottoDrawRepository lottoDrawRepository;

    public SavedNumberService(SavedNumberRepository savedNumberRepository, LottoDrawRepository lottoDrawRepository) {
        this.savedNumberRepository = savedNumberRepository;
        this.lottoDrawRepository = lottoDrawRepository;
    }

    public SavedNumberResponse save(Long userId, String source, List<Integer> numbers) {
        int targetDrawNo = lottoDrawRepository.findMaxDrawNo().orElse(0) + 1;
        SavedNumber entity = new SavedNumber(
                userId,
                source,
                targetDrawNo,
                numbers.get(0),
                numbers.get(1),
                numbers.get(2),
                numbers.get(3),
                numbers.get(4),
                numbers.get(5),
                Instant.now()
        );
        return toResponse(savedNumberRepository.save(entity));
    }

    public List<SavedNumberResponse> getSaved(Long userId) {
        return savedNumberRepository.findByUserIdOrderBySavedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private SavedNumberResponse toResponse(SavedNumber entity) {
        return new SavedNumberResponse(
                entity.getId(),
                entity.getSource(),
                entity.getTargetDrawNo(),
                entity.numbers(),
                entity.getSavedAt()
        );
    }
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.savednumber.SavedNumberServiceTest"`
Expected: `BUILD SUCCESSFUL`, 3 tests passed

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/savednumber/SaveNumberRequest.java backend/src/main/java/com/lottopredictor/backend/savednumber/SavedNumberResponse.java backend/src/main/java/com/lottopredictor/backend/savednumber/SavedNumberService.java backend/src/test/java/com/lottopredictor/backend/savednumber/SavedNumberServiceTest.java
git commit -m "Add SavedNumberService with target-draw-no calculation"
```

---

### Task 3: `SavedNumberController`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/api/SavedNumberController.java`

**Interfaces:**
- Consumes: `SavedNumberService`(Task 2), `@AuthPrincipal`/`AuthenticatedUser`(기존)
- Produces: `POST /api/saved-numbers`(body `SaveNumberRequest`) → `SavedNumberResponse`. `GET /api/saved-numbers` → `List<SavedNumberResponse>`(최신순)

이 코드베이스는 컨트롤러를 직접 테스트하지 않는 컨벤션이다. 전체 빌드 통과로 검증한다.

- [ ] **Step 1: `SavedNumberController` 작성**

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.savednumber.SaveNumberRequest;
import com.lottopredictor.backend.savednumber.SavedNumberResponse;
import com.lottopredictor.backend.savednumber.SavedNumberService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class SavedNumberController {

    private final SavedNumberService savedNumberService;

    public SavedNumberController(SavedNumberService savedNumberService) {
        this.savedNumberService = savedNumberService;
    }

    @PostMapping("/api/saved-numbers")
    public SavedNumberResponse save(@RequestBody SaveNumberRequest request, @AuthPrincipal AuthenticatedUser principal) {
        return savedNumberService.save(principal.userId(), request.source(), request.numbers());
    }

    @GetMapping("/api/saved-numbers")
    public List<SavedNumberResponse> list(@AuthPrincipal AuthenticatedUser principal) {
        return savedNumberService.getSaved(principal.userId());
    }
}
```

- [ ] **Step 2: 전체 빌드 확인**

Run: `cd backend && ./gradlew build`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/api/SavedNumberController.java
git commit -m "Add saved-numbers endpoints"
```

---

### Task 4: 프론트 `lib/savedNumbers.ts`

**Files:**
- Create: `frontend/lib/savedNumbers.ts`
- Test: `frontend/lib/savedNumbers.test.ts`

**Interfaces:**
- Produces: `type SavedNumberSource = "GENERATE" | "TAROT"`. `interface SavedNumberResult { id: number; source: SavedNumberSource; targetDrawNo: number; numbers: number[]; savedAt: string }`. `saveNumbers(source: SavedNumberSource, numbers: number[], token: string): Promise<SavedNumberResult>`. `getSavedNumbers(token: string): Promise<SavedNumberResult[]>`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveNumbers, getSavedNumbers } from "./savedNumbers";

describe("saveNumbers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the saved record on success", async () => {
    const payload = {
      id: 1,
      source: "GENERATE",
      targetDrawNo: 1181,
      numbers: [1, 2, 3, 4, 5, 6],
      savedAt: "2026-07-24T10:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await saveNumbers("GENERATE", [1, 2, 3, 4, 5, 6], "jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(saveNumbers("TAROT", [1, 2, 3, 4, 5, 6], "jwt-abc")).rejects.toThrow(
      "번호 저장에 실패했습니다."
    );
  });
});

describe("getSavedNumbers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the saved list on success", async () => {
    const payload = [
      {
        id: 1,
        source: "GENERATE",
        targetDrawNo: 1181,
        numbers: [1, 2, 3, 4, 5, 6],
        savedAt: "2026-07-24T10:00:00Z",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getSavedNumbers("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getSavedNumbers("jwt-abc")).rejects.toThrow("저장된 번호를 불러오지 못했습니다.");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/savedNumbers.test.ts`
Expected: FAIL (`./savedNumbers` 모듈이 아직 없음)

- [ ] **Step 3: `lib/savedNumbers.ts` 작성**

```typescript
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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/savedNumbers.test.ts`
Expected: 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/savedNumbers.ts frontend/lib/savedNumbers.test.ts
git commit -m "Add saved-numbers API client functions"
```

---

### Task 5: 프론트 `lib/groupSavedNumbers.ts`

**Files:**
- Create: `frontend/lib/groupSavedNumbers.ts`
- Test: `frontend/lib/groupSavedNumbers.test.ts`

**Interfaces:**
- Consumes: `SavedNumberResult`(Task 4)
- Produces: `interface WeekGroup { weekStart: string; items: SavedNumberResult[] }`. `interface MonthGroup { monthLabel: string; weeks: WeekGroup[] }`. `groupSavedNumbers(items: SavedNumberResult[]): MonthGroup[]` — 저장일(`savedAt`) 기준 월별(최신순) → 그 안에서 주별(월요일 시작, 최신순)로 그룹핑

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import { describe, expect, it } from "vitest";
import { groupSavedNumbers } from "./groupSavedNumbers";
import type { SavedNumberResult } from "./savedNumbers";

function item(savedAt: string, id = 1): SavedNumberResult {
  return { id, source: "GENERATE", targetDrawNo: 1181, numbers: [1, 2, 3, 4, 5, 6], savedAt };
}

describe("groupSavedNumbers", () => {
  it("returns an empty array for no saved numbers", () => {
    expect(groupSavedNumbers([])).toEqual([]);
  });

  it("groups items saved in the same week under one week entry", () => {
    const groups = groupSavedNumbers([
      item("2026-07-06T12:00:00", 1),
      item("2026-07-08T12:00:00", 2),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].weeks).toHaveLength(1);
    expect(groups[0].weeks[0].items).toHaveLength(2);
  });

  it("splits items saved in different weeks of the same month", () => {
    const groups = groupSavedNumbers([
      item("2026-07-06T12:00:00", 1),
      item("2026-07-13T12:00:00", 2),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].weeks).toHaveLength(2);
  });

  it("splits items saved in different months and orders the most recent month first", () => {
    const groups = groupSavedNumbers([
      item("2026-06-15T12:00:00", 1),
      item("2026-07-06T12:00:00", 2),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].monthLabel).toBe("2026년 7월");
    expect(groups[1].monthLabel).toBe("2026년 6월");
  });

  it("orders weeks within a month most recent first", () => {
    const groups = groupSavedNumbers([
      item("2026-07-06T12:00:00", 1),
      item("2026-07-13T12:00:00", 2),
    ]);

    expect(groups[0].weeks[0].weekStart).toBe("2026-07-13");
    expect(groups[0].weeks[1].weekStart).toBe("2026-07-06");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/groupSavedNumbers.test.ts`
Expected: FAIL (`./groupSavedNumbers` 모듈이 아직 없음)

- [ ] **Step 3: `lib/groupSavedNumbers.ts` 작성**

```typescript
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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/groupSavedNumbers.test.ts`
Expected: 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/groupSavedNumbers.ts frontend/lib/groupSavedNumbers.test.ts
git commit -m "Add groupSavedNumbers month/week grouping helper"
```

---

### Task 6: `/generate` 결과 카드에 저장 버튼 추가

**Files:**
- Modify: `frontend/app/generate/page.tsx`
- Modify: `frontend/app/generate/generate.module.css`

**Interfaces:**
- Consumes: `saveNumbers`(Task 4), `useAuth`(기존)

- [ ] **Step 1: import 추가**

현재:

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
import LottoDrawAnimation from "../components/LottoDrawAnimation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
```

다음으로 교체 (1줄 추가):

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
import LottoDrawAnimation from "../components/LottoDrawAnimation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
import { saveNumbers } from "../../lib/savedNumbers";
```

- [ ] **Step 2: 저장 상태 추가**

현재:

```tsx
  const [latestDraw, setLatestDraw] = useState<DrawResponse | null>(null);
  const [weeklyPick, setWeeklyPick] = useState<WeeklyPickResult | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyPickResult[]>([]);
```

다음으로 교체:

```tsx
  const [latestDraw, setLatestDraw] = useState<DrawResponse | null>(null);
  const [weeklyPick, setWeeklyPick] = useState<WeeklyPickResult | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyPickResult[]>([]);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});
```

- [ ] **Step 3: 새로 생성할 때 저장 상태 초기화**

현재:

```tsx
      const data = await generateNumbers(mode, sets, auth.token);
      refreshProgress();
      if (sets === 1) {
```

다음으로 교체:

```tsx
      const data = await generateNumbers(mode, sets, auth.token);
      refreshProgress();
      setSavedIndices(new Set());
      setSaveErrors({});
      if (sets === 1) {
```

- [ ] **Step 4: 저장 처리 함수 추가**

`handleDrawComplete` 함수 바로 다음 줄에 추가:

```tsx
  async function handleSave(index: number, set: number[]) {
    if (!auth) return;
    setSavingIndex(index);
    setSaveErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    try {
      await saveNumbers("GENERATE", set, auth.token);
      setSavedIndices((prev) => new Set(prev).add(index));
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [index]: err instanceof Error ? err.message : "저장에 실패했습니다.",
      }));
    } finally {
      setSavingIndex(null);
    }
  }
```

- [ ] **Step 5: 결과 카드에 저장 버튼 추가**

현재:

```tsx
          {result.results.map((set, i) => (
            <div key={i} className={styles.resultCard}>
              <span className={styles.resultIndex}>{i + 1}</span>
              <div className={styles.resultBalls}>
                {set.map((n) => (
                  <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ))}
```

다음으로 교체:

```tsx
          {result.results.map((set, i) => (
            <div key={i} className={styles.resultCard}>
              <span className={styles.resultIndex}>{i + 1}</span>
              <div className={styles.resultBalls}>
                {set.map((n) => (
                  <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                    {n}
                  </span>
                ))}
              </div>
              <div className={styles.saveWrap}>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => handleSave(i, set)}
                  disabled={savedIndices.has(i) || savingIndex === i}
                >
                  {savedIndices.has(i) ? "저장됨" : savingIndex === i ? "저장 중..." : "저장"}
                </button>
                {saveErrors[i] && <p className={styles.saveError}>{saveErrors[i]}</p>}
              </div>
            </div>
          ))}
```

- [ ] **Step 6: CSS 추가**

`frontend/app/generate/generate.module.css` 맨 끝에 추가:

```css

.saveWrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  margin-left: auto;
}

.saveButton {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}

.saveButton:hover:not(:disabled) {
  background: var(--accent-soft);
}

.saveButton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.saveError {
  font-size: 0.72rem;
  color: var(--danger);
}
```

- [ ] **Step 7: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 8: 브라우저 수동 확인**

로그인 상태로 `/generate`에서 번호를 생성하고, 각 결과 카드의 "저장" 버튼을 눌러 "저장됨"으로 바뀌는지, 세트를 여러 개(2개 이상) 생성했을 때 카드마다 독립적으로 저장되는지 확인한다.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/generate/page.tsx frontend/app/generate/generate.module.css
git commit -m "Add save button to generate result cards"
```

---

### Task 7: `/tarot` 결과에 저장 버튼 추가

**Files:**
- Modify: `frontend/app/tarot/page.tsx`
- Modify: `frontend/app/tarot/page.module.css`

**Interfaces:**
- Consumes: `saveNumbers`(Task 4), `useAuth`(기존)

- [ ] **Step 1: import 추가**

현재:

```tsx
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { consumeTarotUsage } from "../../lib/progress";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
```

다음으로 교체:

```tsx
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { consumeTarotUsage } from "../../lib/progress";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
import { saveNumbers } from "../../lib/savedNumbers";
```

- [ ] **Step 2: 저장 상태 추가**

현재:

```tsx
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const [quotaError, setQuotaError] = useState<string | null>(null);
```

다음으로 교체:

```tsx
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
```

- [ ] **Step 3: `handleReset`에서 저장 상태도 초기화**

현재:

```tsx
  function handleReset() {
    setDeck(shuffleCards(TAROT_CARDS));
    setSelected(null);
    setDirection(null);
    setSpreadSlots([]);
    setNumbers(null);
    setPendingNumbers(null);
    setAnimating(false);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }
```

다음으로 교체:

```tsx
  function handleReset() {
    setDeck(shuffleCards(TAROT_CARDS));
    setSelected(null);
    setDirection(null);
    setSpreadSlots([]);
    setNumbers(null);
    setPendingNumbers(null);
    setAnimating(false);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setSaved(false);
    setSaving(false);
    setSaveError(null);
  }
```

- [ ] **Step 4: 저장 처리 함수 추가**

`handleNumbersDrawComplete` 함수 바로 다음 줄에 추가:

```tsx
  async function handleSaveNumbers() {
    if (!auth || !numbers) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveNumbers("TAROT", numbers, auth.token);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }
```

- [ ] **Step 5: 첫 번째 번호 결과 블록에 저장 버튼 추가 (`viewMode === "with-zodiac"`)**

현재:

```tsx
          {numbers && (
            <div className={styles.numbersRow}>
              {numbers.map((n) => (
                <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                  {n}
                </span>
              ))}
            </div>
          )}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
        </div>
      )}

      {viewMode === "tarot-only" && spreadReady && (
```

다음으로 교체:

```tsx
          {numbers && (
            <div className={styles.numbersRow}>
              {numbers.map((n) => (
                <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                  {n}
                </span>
              ))}
            </div>
          )}

          {numbers && (
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSaveNumbers}
              disabled={saved || saving}
            >
              {saved ? "저장됨" : saving ? "저장 중..." : "저장"}
            </button>
          )}
          {saveError && <p className={styles.saveError}>{saveError}</p>}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
        </div>
      )}

      {viewMode === "tarot-only" && spreadReady && (
```

- [ ] **Step 6: 두 번째 번호 결과 블록에 저장 버튼 추가 (`viewMode === "tarot-only"`)**

현재 (파일 맨 끝부분, 두 번째 `numbersRow` 블록):

```tsx
          {numbers && (
            <div className={styles.numbersRow}>
              {numbers.map((n) => (
                <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                  {n}
                </span>
              ))}
            </div>
          )}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
```

다음으로 교체:

```tsx
          {numbers && (
            <div className={styles.numbersRow}>
              {numbers.map((n) => (
                <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                  {n}
                </span>
              ))}
            </div>
          )}

          {numbers && (
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSaveNumbers}
              disabled={saved || saving}
            >
              {saved ? "저장됨" : saving ? "저장 중..." : "저장"}
            </button>
          )}
          {saveError && <p className={styles.saveError}>{saveError}</p>}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
```

이 파일에는 `numbersRow` + `resetButton` 조합이 두 곳(위/아래 뷰 모드) 있다. 이미 Step 5에서 첫 번째를 교체했으므로, Step 6은 남은 두 번째 블록에 적용한다.

- [ ] **Step 7: CSS 추가**

`frontend/app/tarot/page.module.css` 맨 끝에 추가:

```css

.saveButton {
  align-self: center;
  padding: 0.5rem 1.1rem;
  border: 1px solid var(--cosmic-border);
  border-radius: 999px;
  background: transparent;
  color: var(--cosmic-gold);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.saveButton:hover:not(:disabled) {
  border-color: var(--cosmic-gold);
}

.saveButton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.saveError {
  font-size: 0.78rem;
  color: var(--cosmic-text-secondary);
  text-align: center;
}
```

- [ ] **Step 8: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 9: 브라우저 수동 확인**

로그인 상태로 `/tarot`에서 카드를 뽑고 번호를 뽑은 뒤, "저장" 버튼이 나타나는지, 누르면 "저장됨"으로 바뀌는지, "다시 뽑기" 후에는 저장 버튼 상태가 초기화되는지 확인한다. 별자리 모드/타로 전용 모드 양쪽에서 확인한다.

- [ ] **Step 10: Commit**

```bash
git add frontend/app/tarot/page.tsx frontend/app/tarot/page.module.css
git commit -m "Add save button to tarot number results"
```

---

### Task 8: `/mypage` 페이지 + Nav 링크

**Files:**
- Create: `frontend/app/mypage/page.tsx`
- Create: `frontend/app/mypage/page.module.css`
- Modify: `frontend/app/components/Nav.tsx`

**Interfaces:**
- Consumes: `getSavedNumbers`(Task 4), `groupSavedNumbers`(Task 5), `useAuth`(기존), `getKakaoAuthorizeUrl`(기존)

- [ ] **Step 1: `frontend/app/mypage/page.tsx` 작성**

```tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { getSavedNumbers, type SavedNumberResult } from "../../lib/savedNumbers";
import { groupSavedNumbers } from "../../lib/groupSavedNumbers";
import { getBallColor } from "../../lib/lottoBall";
import { useAuth } from "../contexts/AuthContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const SOURCE_LABELS: Record<SavedNumberResult["source"], string> = {
  GENERATE: "번호생성",
  TAROT: "타로",
};

export default function MyPage() {
  const { auth } = useAuth();
  const [savedNumbers, setSavedNumbers] = useState<SavedNumberResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    getSavedNumbers(auth.token)
      .then(setSavedNumbers)
      .catch(() => setError("저장된 번호를 불러오지 못했습니다."));
  }, [auth]);

  if (!auth) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>마이페이지</h1>
        </section>
        <div className={styles.card}>
          <p className={styles.error}>마이페이지를 이용하려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.loginButton}>
            카카오로 로그인
          </a>
        </div>
      </div>
    );
  }

  const groups = groupSavedNumbers(savedNumbers);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>마이페이지</h1>
        <p className={styles.subtitle}>지금까지 저장한 번호를 월별/주별로 모아봤어요.</p>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {!error && groups.length === 0 && <p className={styles.empty}>아직 저장한 번호가 없어요.</p>}

      {groups.map((month) => (
        <div key={month.monthLabel} className={styles.monthGroup}>
          <h2 className={styles.monthLabel}>{month.monthLabel}</h2>
          {month.weeks.map((week) => (
            <div key={week.weekStart} className={styles.weekGroup}>
              <span className={styles.weekLabel}>{week.weekStart} 주</span>
              <div className={styles.itemList}>
                {week.items.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <span className={styles.sourceBadge}>{SOURCE_LABELS[item.source]}</span>
                    <div className={styles.itemBalls}>
                      {item.numbers.map((n) => (
                        <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                          {n}
                        </span>
                      ))}
                    </div>
                    <span className={styles.itemMeta}>
                      {item.targetDrawNo}회 대상 · {new Date(item.savedAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `frontend/app/mypage/page.module.css` 작성**

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

.loginButton {
  padding: 0.75rem 1.4rem;
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-foreground);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}

.error {
  color: var(--danger);
  font-size: 0.9rem;
  text-align: center;
}

.empty {
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
}

.monthGroup {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.monthLabel {
  font-size: 1.15rem;
  font-weight: 800;
}

.weekGroup {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.weekLabel {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.itemList {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--surface-border);
}

.sourceBadge {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--accent);
  border-radius: 999px;
  white-space: nowrap;
}

.itemBalls {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.ball {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
  color: #ffffff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
}

.itemMeta {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}
```

- [ ] **Step 3: `Nav.tsx`에 로그인 상태일 때만 마이페이지 링크 추가**

현재:

```tsx
      {auth ? (
        <div className={styles.authSection}>
          <span className={styles.authNickname}>{auth.nickname}님</span>
          <button type="button" className={styles.logoutButton} onClick={logout}>
            로그아웃
          </button>
        </div>
      ) : (
```

다음으로 교체:

```tsx
      {auth ? (
        <div className={styles.authSection}>
          <Link
            href="/mypage"
            className={`${styles.link} ${pathname === "/mypage" ? styles.linkActive : ""}`}
          >
            마이페이지
          </Link>
          <span className={styles.authNickname}>{auth.nickname}님</span>
          <button type="button" className={styles.logoutButton} onClick={logout}>
            로그아웃
          </button>
        </div>
      ) : (
```

- [ ] **Step 4: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 브라우저 수동 확인**

로그인 상태에서 상단 네비게이션에 "마이페이지" 링크가 보이는지, 클릭하면 `/mypage`에서 저장된 번호가 월별/주별로 묶여 표시되는지 확인한다. 로그아웃 상태에서는 링크가 안 보이고, `/mypage`에 직접 접근하면 로그인 안내가 뜨는지 확인한다.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/mypage/page.tsx frontend/app/mypage/page.module.css frontend/app/components/Nav.tsx
git commit -m "Add mypage with month/week grouped saved numbers"
```
