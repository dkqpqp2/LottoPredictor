# 연금복권720+ 최근 당첨번호 + 이번주 추천 + 지난 이력 (5단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로또의 "최근 당첨번호 / 이번주 추천 번호 / 지난 추천 이력" 공용(비로그인) 기능을 연금복권720+에도 동일한 패턴으로 추가한다.

**Architecture:** 새 패키지 `com.lottopredictor.backend.pensionweeklypick`에 로또 `weekly_picks`와 동일한 구조의 `pension_weekly_picks` 테이블/엔티티/서비스를 만들되, 2단계의 `PensionNumberGenerationService.generate()`(완전 랜덤 생성)와 4단계의 `PensionMatchCalculator.calculate()`(실제 등수 판정)를 그대로 재사용해 새 매칭/생성 로직을 추가하지 않는다. 최근 당첨번호 표시를 위해 지금까지 없던 공개 조회 엔드포인트(`GET /api/pension/draws`)도 함께 추가한다. 프론트는 `/pension` 페이지에 세 섹션을 추가한다.

**Tech Stack:** Spring Boot 4.1.0 (Java 21, Spring Data JPA), JUnit 5 + Mockito + AssertJ, Next.js 16 App Router + TypeScript, Vitest.

## Global Constraints

- `pension_weekly_picks`는 사이트 전체가 공유하는 공용 데이터다 (로그인 불필요, 유저별 아님) — 이미 만든 유저별 `pension_saved_numbers`(4단계)와는 완전히 별개다.
- `pension_weekly_picks` 테이블은 로또의 `weekly_picks`가 나중에 마이그레이션으로 고친 최종 스키마(surrogate `id bigserial` PK + `target_draw_no unique`)를 처음부터 그대로 쓴다 — 로또가 원래 겪었던 "달력 주차를 PK로 쓰다가 결과가 나와도 다음 월요일까지 낡은 추천이 표시되는" 버그를 재현하지 않는다.
- 번호 생성은 기존 `PensionNumberGenerationService.generate()`(2단계, 완전 랜덤, `PensionDrawRepository`에 의존하지 않음)를 그대로 호출한다 — 이 서비스 자체는 이번 플랜에서 전혀 수정하지 않는다.
- 등수/보너스 판정은 기존 `PensionMatchCalculator.calculate(int, String, PensionDraw)`(4단계)를 그대로 호출한다 — 이 계산기 자체는 이번 플랜에서 전혀 수정하지 않는다.
- `number`/`bonusNumber`는 항상 정확히 6자 문자열이다 — 정수 변환 없이 문자열 그대로 다룬다.
- `GET /api/pension/weekly-pick`, `GET /api/pension/weekly-pick/history`, `GET /api/pension/draws` 셋 다 로그인 불필요 (`@AuthPrincipal` 없음) — 로또의 `WeeklyPickController`/`DrawController`와 동일한 수준.
- 엔티티/리포지토리/컨트롤러는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 (기존 `WeeklyPick`/`WeeklyPickRepository`/`WeeklyPickController`/`DrawController`도 동일) — 컴파일 확인 + 전체 테스트 스위트로 검증한다.
- `/pension` 페이지는 전용 테스트를 작성하지 않는다 — 타입체크(`tsc --noEmit`) + 브라우저 확인으로 검증한다.

---

### Task 1: `PensionWeeklyPick` 엔티티 + 리포지토리 + DB 마이그레이션

**Files:**
- Create: `db/migrations/0012_create_pension_weekly_picks.sql`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPick.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickRepository.java`

**Interfaces:**
- Consumes: 없음
- Produces: `PensionWeeklyPick(LocalDate weekStart, Integer targetDrawNo, Integer groupNo, String number)` 생성자 + `getId()`, `getWeekStart()`, `getTargetDrawNo()`, `getGroupNo()`, `getNumber()`, `getCreatedAt()` 게터. `PensionWeeklyPickRepository.findTopByOrderByIdDesc(): Optional<PensionWeeklyPick>`, `findByIdLessThanOrderByIdDesc(Long id, Pageable pageable): List<PensionWeeklyPick>`. Task 2가 이 엔티티/리포지토리를 그대로 사용한다.

이 태스크는 다른 태스크와 독립적이다. 엔티티/리포지토리/마이그레이션은 이 코드베이스 컨벤션상 전용 테스트가 없다.

- [ ] **Step 1: DB 마이그레이션 작성**

`db/migrations/0012_create_pension_weekly_picks.sql`:

```sql
create table if not exists pension_weekly_picks (
  id bigserial primary key,
  week_start date not null,
  target_draw_no integer not null unique,
  group_no integer not null,
  number varchar(6) not null,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: `PensionWeeklyPick` 엔티티 작성**

`backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPick.java`:

```java
package com.lottopredictor.backend.pensionweeklypick;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "pension_weekly_picks")
public class PensionWeeklyPick {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "target_draw_no", nullable = false)
    private Integer targetDrawNo;

    @Column(name = "group_no", nullable = false)
    private Integer groupNo;

    @Column(name = "number", nullable = false)
    private String number;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected PensionWeeklyPick() {
    }

    public PensionWeeklyPick(LocalDate weekStart, Integer targetDrawNo, Integer groupNo, String number) {
        this.weekStart = weekStart;
        this.targetDrawNo = targetDrawNo;
        this.groupNo = groupNo;
        this.number = number;
    }

    public Long getId() {
        return id;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    public Integer getTargetDrawNo() {
        return targetDrawNo;
    }

    public Integer getGroupNo() {
        return groupNo;
    }

    public String getNumber() {
        return number;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
```

- [ ] **Step 3: `PensionWeeklyPickRepository` 작성**

`backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickRepository.java`:

```java
package com.lottopredictor.backend.pensionweeklypick;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PensionWeeklyPickRepository extends JpaRepository<PensionWeeklyPick, Long> {

    Optional<PensionWeeklyPick> findTopByOrderByIdDesc();

    List<PensionWeeklyPick> findByIdLessThanOrderByIdDesc(Long id, Pageable pageable);
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava compileTestJava`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0012_create_pension_weekly_picks.sql backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPick.java backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickRepository.java
git commit -m "Add PensionWeeklyPick entity and repository"
```

---

### Task 2: `PensionWeeklyPickResult` + `PensionWeeklyPickService`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickResult.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `PensionWeeklyPick`/`PensionWeeklyPickRepository`; 기존 `PensionDrawRepository`(`findMaxDrawNo()`, `existsById(Integer)`, `findById(Integer)`)와 `PensionDraw`(`getGroupNo()`, `getNumber()`, `getBonusNumber()`, `getDrawDate()`); 기존 `PensionNumberGenerationService.generate(): PensionGenerateResult`(2단계); 기존 `PensionMatchCalculator.calculate(int, String, PensionDraw): MatchResult`(4단계, `MatchResult.rank()`/`.bonusMatch()`)
- Produces: `PensionWeeklyPickResult` record. `PensionWeeklyPickService.getCurrent(): PensionWeeklyPickResult`, `PensionWeeklyPickService.getHistory(int limit): List<PensionWeeklyPickResult>`. Task 3이 이 서비스를 그대로 사용한다.

이 태스크는 Task 1에 의존한다.

- [ ] **Step 1: `PensionWeeklyPickResult` 작성**

`backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickResult.java`:

```java
package com.lottopredictor.backend.pensionweeklypick;

import java.time.LocalDate;

public record PensionWeeklyPickResult(
        LocalDate weekStart,
        int targetDrawNo,
        int groupNo,
        String number,
        boolean resultAvailable,
        String rank,
        Boolean bonusMatch,
        Integer actualGroupNo,
        String actualNumber,
        String actualBonusNumber,
        String actualDrawDate
) {
    public static PensionWeeklyPickResult pending(LocalDate weekStart, int targetDrawNo, int groupNo, String number) {
        return new PensionWeeklyPickResult(
                weekStart, targetDrawNo, groupNo, number, false, null, null, null, null, null, null
        );
    }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickServiceTest.java`:

```java
package com.lottopredictor.backend.pensionweeklypick;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import com.lottopredictor.backend.pensiongenerate.PensionGenerateResult;
import com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PensionWeeklyPickServiceTest {

    @Mock
    private PensionWeeklyPickRepository pensionWeeklyPickRepository;

    @Mock
    private PensionDrawRepository pensionDrawRepository;

    @Mock
    private PensionNumberGenerationService pensionNumberGenerationService;

    @Test
    void generatesAndSavesANewPickWhenNoneExistsYet() {
        when(pensionWeeklyPickRepository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());
        when(pensionDrawRepository.findMaxDrawNo()).thenReturn(Optional.of(325));
        when(pensionNumberGenerationService.generate()).thenReturn(new PensionGenerateResult(3, "011391"));
        when(pensionWeeklyPickRepository.save(any(PensionWeeklyPick.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pensionDrawRepository.findById(326)).thenReturn(Optional.empty());

        PensionWeeklyPickService service = new PensionWeeklyPickService(
                pensionWeeklyPickRepository, pensionDrawRepository, pensionNumberGenerationService
        );
        PensionWeeklyPickResult result = service.getCurrent();

        assertThat(result.targetDrawNo()).isEqualTo(326);
        assertThat(result.groupNo()).isEqualTo(3);
        assertThat(result.number()).isEqualTo("011391");
        assertThat(result.resultAvailable()).isFalse();
    }

    @Test
    void reusesTheCurrentPickWhenItsTargetDrawIsNotYetResolved() {
        LocalDate weekStart = LocalDate.of(2026, 7, 20);
        PensionWeeklyPick existing = new PensionWeeklyPick(weekStart, 326, 3, "011391");
        when(pensionWeeklyPickRepository.findTopByOrderByIdDesc()).thenReturn(Optional.of(existing));
        when(pensionDrawRepository.existsById(326)).thenReturn(false);
        when(pensionDrawRepository.findById(326)).thenReturn(Optional.empty());

        PensionWeeklyPickService service = new PensionWeeklyPickService(
                pensionWeeklyPickRepository, pensionDrawRepository, pensionNumberGenerationService
        );
        PensionWeeklyPickResult result = service.getCurrent();

        assertThat(result.targetDrawNo()).isEqualTo(326);
        verifyNoInteractions(pensionNumberGenerationService);
    }

    @Test
    void advancesToANewPickOnceTheCurrentTargetDrawIsResolved() {
        LocalDate weekStart = LocalDate.of(2026, 7, 6);
        PensionWeeklyPick resolved = new PensionWeeklyPick(weekStart, 325, 3, "011391");
        when(pensionWeeklyPickRepository.findTopByOrderByIdDesc()).thenReturn(Optional.of(resolved));
        when(pensionDrawRepository.existsById(325)).thenReturn(true);
        when(pensionDrawRepository.findMaxDrawNo()).thenReturn(Optional.of(325));
        when(pensionNumberGenerationService.generate()).thenReturn(new PensionGenerateResult(2, "485216"));
        when(pensionWeeklyPickRepository.save(any(PensionWeeklyPick.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pensionDrawRepository.findById(326)).thenReturn(Optional.empty());

        PensionWeeklyPickService service = new PensionWeeklyPickService(
                pensionWeeklyPickRepository, pensionDrawRepository, pensionNumberGenerationService
        );
        PensionWeeklyPickResult result = service.getCurrent();

        assertThat(result.targetDrawNo()).isEqualTo(326);
        assertThat(result.groupNo()).isEqualTo(2);
        assertThat(result.number()).isEqualTo("485216");
        assertThat(result.resultAvailable()).isFalse();
        verify(pensionWeeklyPickRepository).save(any(PensionWeeklyPick.class));
    }

    @Test
    void historyReportsRankAndBonusForAResolvedPastPick() {
        PensionWeeklyPick current = new PensionWeeklyPick(LocalDate.of(2026, 7, 20), 326, 2, "485216");
        PensionWeeklyPick past = new PensionWeeklyPick(LocalDate.of(2026, 7, 13), 325, 3, "011391");
        when(pensionWeeklyPickRepository.findTopByOrderByIdDesc()).thenReturn(Optional.of(current));
        when(pensionDrawRepository.existsById(326)).thenReturn(false);
        when(pensionWeeklyPickRepository.findByIdLessThanOrderByIdDesc(eq(current.getId()), any()))
                .thenReturn(List.of(past));
        PensionDraw draw = new PensionDraw(325, LocalDate.of(2026, 7, 23), 3, "011391", "438906");
        when(pensionDrawRepository.findById(325)).thenReturn(Optional.of(draw));

        PensionWeeklyPickService service = new PensionWeeklyPickService(
                pensionWeeklyPickRepository, pensionDrawRepository, pensionNumberGenerationService
        );
        List<PensionWeeklyPickResult> history = service.getHistory(5);

        assertThat(history).hasSize(1);
        PensionWeeklyPickResult result = history.get(0);
        assertThat(result.resultAvailable()).isTrue();
        assertThat(result.rank()).isEqualTo("1등");
        assertThat(result.bonusMatch()).isFalse();
        assertThat(result.actualGroupNo()).isEqualTo(3);
        assertThat(result.actualNumber()).isEqualTo("011391");
        assertThat(result.actualBonusNumber()).isEqualTo("438906");
    }
}
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.pensionweeklypick.PensionWeeklyPickServiceTest"`
Expected: FAIL — 컴파일 에러 (`PensionWeeklyPickService` 클래스가 아직 없음)

- [ ] **Step 4: `PensionWeeklyPickService` 구현 작성**

`backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickService.java`:

```java
package com.lottopredictor.backend.pensionweeklypick;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import com.lottopredictor.backend.pensiondraw.PensionMatchCalculator;
import com.lottopredictor.backend.pensiongenerate.PensionGenerateResult;
import com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Service
public class PensionWeeklyPickService {

    private final PensionWeeklyPickRepository pensionWeeklyPickRepository;
    private final PensionDrawRepository pensionDrawRepository;
    private final PensionNumberGenerationService pensionNumberGenerationService;

    public PensionWeeklyPickService(
            PensionWeeklyPickRepository pensionWeeklyPickRepository,
            PensionDrawRepository pensionDrawRepository,
            PensionNumberGenerationService pensionNumberGenerationService
    ) {
        this.pensionWeeklyPickRepository = pensionWeeklyPickRepository;
        this.pensionDrawRepository = pensionDrawRepository;
        this.pensionNumberGenerationService = pensionNumberGenerationService;
    }

    public PensionWeeklyPickResult getCurrent() {
        return toResult(getCurrentPick());
    }

    public List<PensionWeeklyPickResult> getHistory(int limit) {
        PensionWeeklyPick current = getCurrentPick();
        return pensionWeeklyPickRepository
                .findByIdLessThanOrderByIdDesc(current.getId(), PageRequest.of(0, limit))
                .stream()
                .map(this::toResult)
                .toList();
    }

    private PensionWeeklyPick getCurrentPick() {
        return pensionWeeklyPickRepository.findTopByOrderByIdDesc()
                .filter(pick -> !isResolved(pick))
                .orElseGet(() -> generateAndSave(currentWeekStart()));
    }

    private boolean isResolved(PensionWeeklyPick pick) {
        return pensionDrawRepository.existsById(pick.getTargetDrawNo());
    }

    private LocalDate currentWeekStart() {
        return LocalDate.now(ZoneId.of("Asia/Seoul")).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private PensionWeeklyPick generateAndSave(LocalDate weekStart) {
        int targetDrawNo = pensionDrawRepository.findMaxDrawNo().orElse(0) + 1;
        PensionGenerateResult generated = pensionNumberGenerationService.generate();
        PensionWeeklyPick pick = new PensionWeeklyPick(weekStart, targetDrawNo, generated.groupNo(), generated.number());
        return pensionWeeklyPickRepository.save(pick);
    }

    private PensionWeeklyPickResult toResult(PensionWeeklyPick pick) {
        return pensionDrawRepository.findById(pick.getTargetDrawNo())
                .map(draw -> buildAvailableResult(pick, draw))
                .orElseGet(() -> PensionWeeklyPickResult.pending(
                        pick.getWeekStart(), pick.getTargetDrawNo(), pick.getGroupNo(), pick.getNumber()
                ));
    }

    private PensionWeeklyPickResult buildAvailableResult(PensionWeeklyPick pick, PensionDraw draw) {
        PensionMatchCalculator.MatchResult match =
                PensionMatchCalculator.calculate(pick.getGroupNo(), pick.getNumber(), draw);

        return new PensionWeeklyPickResult(
                pick.getWeekStart(),
                pick.getTargetDrawNo(),
                pick.getGroupNo(),
                pick.getNumber(),
                true,
                match.rank(),
                match.bonusMatch(),
                draw.getGroupNo(),
                draw.getNumber(),
                draw.getBonusNumber(),
                draw.getDrawDate().toString()
        );
    }
}
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.pensionweeklypick.PensionWeeklyPickServiceTest"`
Expected: `BUILD SUCCESSFUL`, 4개 테스트 전부 통과

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickResult.java backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickService.java backend/src/test/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickServiceTest.java
git commit -m "Add PensionWeeklyPickService reusing existing generation and matching logic"
```

---

### Task 3: `PensionWeeklyPickController`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/api/PensionWeeklyPickController.java`

**Interfaces:**
- Consumes: Task 2의 `PensionWeeklyPickService.getCurrent()`, `.getHistory(int)`, `PensionWeeklyPickResult`
- Produces: 없음

이 태스크는 Task 2에 의존한다. 컨트롤러는 이 코드베이스 컨벤션상 전용 테스트가 없다 — 컴파일 확인 + 전체 테스트 스위트로 검증한다.

- [ ] **Step 1: `PensionWeeklyPickController` 작성**

기존 `WeeklyPickController`(`backend/src/main/java/com/lottopredictor/backend/api/WeeklyPickController.java`)와 같은 패턴:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.pensionweeklypick.PensionWeeklyPickResult;
import com.lottopredictor.backend.pensionweeklypick.PensionWeeklyPickService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class PensionWeeklyPickController {

    private final PensionWeeklyPickService service;

    public PensionWeeklyPickController(PensionWeeklyPickService service) {
        this.service = service;
    }

    @GetMapping("/api/pension/weekly-pick")
    public PensionWeeklyPickResult current() {
        return service.getCurrent();
    }

    @GetMapping("/api/pension/weekly-pick/history")
    public List<PensionWeeklyPickResult> history(@RequestParam(defaultValue = "5") int limit) {
        return service.getHistory(Math.min(Math.max(limit, 1), 20));
    }
}
```

- [ ] **Step 2: 전체 빌드 확인**

Run: `cd backend && ./gradlew test`
Expected: `BUILD SUCCESSFUL`, 전체 테스트 통과

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/api/PensionWeeklyPickController.java
git commit -m "Add GET /api/pension/weekly-pick and /history endpoints"
```

---

### Task 4: `GET /api/pension/draws` (최근 당첨번호 조회)

**Files:**
- Modify: `backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionDrawRepository.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/api/PensionDrawResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/api/PensionDrawController.java`

**Interfaces:**
- Consumes: 기존 `PensionDraw`(`getDrawNo()`, `getDrawDate()`, `getGroupNo()`, `getNumber()`, `getBonusNumber()`)
- Produces: `PensionDrawRepository.findAllByOrderByDrawNoDesc(Pageable): List<PensionDraw>`. `PensionDrawResponse` record + `PensionDrawResponse.from(PensionDraw): PensionDrawResponse`. Task 5가 이 응답 형태를 그대로 타이핑한다.

이 태스크는 다른 태스크와 독립적이다 (1~4단계에서 이미 만든 `PensionDraw`/`PensionDrawRepository`만 사용). 리포지토리/컨트롤러는 이 코드베이스 컨벤션상 전용 테스트가 없다.

- [ ] **Step 1: `PensionDrawRepository`에 페이지네이션 조회 메서드 추가**

`backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionDrawRepository.java` 전체를 다음으로 교체:

```java
package com.lottopredictor.backend.pensiondraw;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PensionDrawRepository extends JpaRepository<PensionDraw, Integer> {

    @Query("select max(d.drawNo) from PensionDraw d")
    Optional<Integer> findMaxDrawNo();

    List<PensionDraw> findAllByOrderByDrawNoDesc(Pageable pageable);
}
```

- [ ] **Step 2: `PensionDrawResponse` 작성**

`backend/src/main/java/com/lottopredictor/backend/api/PensionDrawResponse.java`:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.pensiondraw.PensionDraw;

import java.time.LocalDate;

public record PensionDrawResponse(
        int drawNo,
        LocalDate drawDate,
        int groupNo,
        String number,
        String bonusNumber
) {
    public static PensionDrawResponse from(PensionDraw draw) {
        return new PensionDrawResponse(
                draw.getDrawNo(), draw.getDrawDate(), draw.getGroupNo(), draw.getNumber(), draw.getBonusNumber()
        );
    }
}
```

- [ ] **Step 3: `PensionDrawController` 작성**

기존 `DrawController`(`backend/src/main/java/com/lottopredictor/backend/api/DrawController.java`)의 페이지네이션 목록 부분만 미러링:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pension/draws")
public class PensionDrawController {

    private final PensionDrawRepository repository;

    public PensionDrawController(PensionDrawRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<PensionDrawResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return repository.findAllByOrderByDrawNoDesc(PageRequest.of(page, size)).stream()
                .map(PensionDrawResponse::from)
                .toList();
    }
}
```

- [ ] **Step 4: 전체 빌드 확인**

Run: `cd backend && ./gradlew test`
Expected: `BUILD SUCCESSFUL`, 전체 테스트 통과 (`PensionDrawRepository`에 메서드를 추가했을 뿐 기존 메서드는 그대로라 회귀 없음)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionDrawRepository.java backend/src/main/java/com/lottopredictor/backend/api/PensionDrawResponse.java backend/src/main/java/com/lottopredictor/backend/api/PensionDrawController.java
git commit -m "Add GET /api/pension/draws for reading pension draw history"
```

---

### Task 5: 프론트 `lib/api.ts`에 연금복권 weekly-pick/draws 타입·함수 추가

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/api.test.ts`

**Interfaces:**
- Consumes: Task 3의 `GET /api/pension/weekly-pick`/`/history` 응답 형태, Task 4의 `GET /api/pension/draws` 응답 형태
- Produces: `PensionDrawResult`, `GetPensionDrawsParams`, `getPensionDraws(params)`, `PensionWeeklyPickResult`, `getPensionWeeklyPick()`, `getPensionWeeklyPickHistory(limit)`. Task 6이 이 타입/함수를 그대로 사용한다.

이 태스크는 백엔드가 이미 이 응답 형태로 동작한다는 전제 하에 코드 의존성 없이 작성 가능하다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/api.test.ts` 맨 끝에 추가:

```ts
describe("getPensionDraws", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the draw list on success", async () => {
    const payload = [
      { drawNo: 325, drawDate: "2026-07-23", groupNo: 3, number: "011391", bonusNumber: "438906" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getPensionDraws({ page: 0, size: 1 });

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPensionDraws({ page: 0, size: 1 })).rejects.toThrow("연금복권 회차 조회에 실패했습니다.");
  });
});

describe("getPensionWeeklyPick", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the current pick on success", async () => {
    const payload = {
      weekStart: "2026-07-27",
      targetDrawNo: 326,
      groupNo: 3,
      number: "011391",
      resultAvailable: false,
      rank: null,
      bonusMatch: null,
      actualGroupNo: null,
      actualNumber: null,
      actualBonusNumber: null,
      actualDrawDate: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getPensionWeeklyPick();

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPensionWeeklyPick()).rejects.toThrow("이번 주 연금복권 추천 번호를 불러오지 못했습니다.");
  });
});

describe("getPensionWeeklyPickHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the history list on success", async () => {
    const payload = [
      {
        weekStart: "2026-07-13",
        targetDrawNo: 325,
        groupNo: 3,
        number: "011391",
        resultAvailable: true,
        rank: "1등",
        bonusMatch: false,
        actualGroupNo: 3,
        actualNumber: "011391",
        actualBonusNumber: "438906",
        actualDrawDate: "2026-07-23",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getPensionWeeklyPickHistory(5);

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPensionWeeklyPickHistory(5)).rejects.toThrow("연금복권 추천 이력을 불러오지 못했습니다.");
  });
});
```

그리고 파일 맨 위 import 줄:

```ts
import { generateNumbers, generatePension } from "./api";
```

를 다음으로 교체:

```ts
import {
  generateNumbers,
  generatePension,
  getPensionDraws,
  getPensionWeeklyPick,
  getPensionWeeklyPickHistory,
} from "./api";
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/api.test.ts`
Expected: FAIL — `getPensionDraws`/`getPensionWeeklyPick`/`getPensionWeeklyPickHistory`가 아직 없음

- [ ] **Step 3: `frontend/lib/api.ts`에 타입/함수 추가**

`frontend/lib/api.ts` 맨 끝(`getWeeklyPickHistory` 함수 뒤)에 추가:

```ts
export interface PensionDrawResult {
  drawNo: number;
  drawDate: string;
  groupNo: number;
  number: string;
  bonusNumber: string;
}

export interface GetPensionDrawsParams {
  page?: number;
  size?: number;
}

export async function getPensionDraws(params: GetPensionDrawsParams): Promise<PensionDrawResult[]> {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.size != null) search.set("size", String(params.size));

  const res = await fetch(`${API_BASE_URL}/api/pension/draws?${search.toString()}`);
  if (!res.ok) {
    throw new Error("연금복권 회차 조회에 실패했습니다.");
  }
  return res.json();
}

export interface PensionWeeklyPickResult {
  weekStart: string;
  targetDrawNo: number;
  groupNo: number;
  number: string;
  resultAvailable: boolean;
  rank: string | null;
  bonusMatch: boolean | null;
  actualGroupNo: number | null;
  actualNumber: string | null;
  actualBonusNumber: string | null;
  actualDrawDate: string | null;
}

export async function getPensionWeeklyPick(): Promise<PensionWeeklyPickResult> {
  const res = await fetch(`${API_BASE_URL}/api/pension/weekly-pick`);
  if (!res.ok) {
    throw new Error("이번 주 연금복권 추천 번호를 불러오지 못했습니다.");
  }
  return res.json();
}

export async function getPensionWeeklyPickHistory(limit = 5): Promise<PensionWeeklyPickResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/pension/weekly-pick/history?limit=${limit}`);
  if (!res.ok) {
    throw new Error("연금복권 추천 이력을 불러오지 못했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/api.test.ts`
Expected: 전부 통과

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/lib/api.test.ts
git commit -m "Add pension weekly-pick and draws client functions"
```

---

### Task 6: `/pension` 페이지에 최근 당첨번호 + 이번주 추천 + 지난 이력 섹션 추가

**Files:**
- Modify: `frontend/app/pension/page.tsx`
- Modify: `frontend/app/pension/page.module.css`

**Interfaces:**
- Consumes: Task 5의 `getPensionDraws`, `getPensionWeeklyPick`, `getPensionWeeklyPickHistory`, `PensionDrawResult`, `PensionWeeklyPickResult`
- Produces: 없음 (이 플랜의 마지막 태스크)

이 태스크는 Task 5에 의존한다. `/pension` 페이지는 이 코드베이스 컨벤션상 전용 테스트가 없다 — 타입체크 + 브라우저 확인으로 검증한다.

- [ ] **Step 1: import 및 state 추가**

`frontend/app/pension/page.tsx`의 다음 두 줄:

```tsx
import { useState } from "react";
import styles from "./page.module.css";
import { generatePension, type PensionGenerateResult } from "../../lib/api";
```

를 다음으로 교체:

```tsx
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import {
  generatePension,
  getPensionDraws,
  getPensionWeeklyPick,
  getPensionWeeklyPickHistory,
  type PensionDrawResult,
  type PensionGenerateResult,
  type PensionWeeklyPickResult,
} from "../../lib/api";
```

`const [pensionResult, setPensionResult] = useState<PensionGenerateResult | null>(null);` 바로 아래에 추가:

```tsx
  const [latestDraw, setLatestDraw] = useState<PensionDrawResult | null>(null);
  const [weeklyPick, setWeeklyPick] = useState<PensionWeeklyPickResult | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<PensionWeeklyPickResult[]>([]);
```

- [ ] **Step 2: 마운트 시 데이터 fetch 추가**

`const quotaExhausted = progress ? progress.pensionUsage.used >= progress.pensionUsage.limit : false;` 바로 아래에 추가:

```tsx

  useEffect(() => {
    getPensionDraws({ page: 0, size: 1 })
      .then((draws) => setLatestDraw(draws[0] ?? null))
      .catch(() => setLatestDraw(null));
    getPensionWeeklyPick()
      .then(setWeeklyPick)
      .catch(() => setWeeklyPick(null));
    getPensionWeeklyPickHistory(5)
      .then(setWeeklyHistory)
      .catch(() => setWeeklyHistory([]));
  }, []);
```

- [ ] **Step 3: 세 섹션 렌더링 추가**

`</section>`(히어로 섹션이 끝나는 지점) 바로 다음, `{!auth ? (` 블록 이전에 추가:

```tsx

      {latestDraw && (
        <div className={styles.latestCard}>
          <span className={styles.latestLabel}>
            {latestDraw.drawNo}회 당첨번호 <span className={styles.latestDate}>{latestDraw.drawDate}</span>
          </span>
          <span className={styles.latestValue}>
            {latestDraw.groupNo}조 {latestDraw.number} (보너스 {latestDraw.bonusNumber})
          </span>
        </div>
      )}

      {weeklyPick && (
        <div className={styles.weeklyCard}>
          <div className={styles.weeklyHeader}>
            <span className={styles.weeklyTitle}>이번 주 추천 번호</span>
            <span className={styles.weeklyTarget}>{weeklyPick.targetDrawNo}회 대상</span>
          </div>
          <span className={styles.weeklyValue}>
            {weeklyPick.groupNo}조 {weeklyPick.number}
          </span>
          {weeklyPick.resultAvailable ? (
            <p className={styles.weeklyResult}>
              {weeklyPick.actualDrawDate} 추첨 결과 {weeklyPick.rank ? weeklyPick.rank : "낙첨"}
              {weeklyPick.bonusMatch ? " · 보너스 당첨" : ""}
            </p>
          ) : (
            <p className={styles.weeklyPending}>{weeklyPick.targetDrawNo}회 추첨 결과를 기다리는 중입니다.</p>
          )}
        </div>
      )}

      {weeklyHistory.length > 0 && (
        <div className={styles.historyCard}>
          <span className={styles.weeklyTitle}>지난 추천 이력</span>
          <div className={styles.historyList}>
            {weeklyHistory.map((h) => (
              <div key={h.weekStart} className={styles.historyRow}>
                <span className={styles.historyDraw}>{h.targetDrawNo}회</span>
                <span className={styles.historyValue}>
                  {h.groupNo}조 {h.number}
                </span>
                <span className={styles.historyResult}>{h.resultAvailable ? (h.rank ?? "낙첨") : "대기중"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 4: CSS 클래스 추가**

`frontend/app/pension/page.module.css` 맨 끝에 추가:

```css
.latestCard {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.1rem 1.5rem;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.latestLabel {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-secondary);
  white-space: nowrap;
}

.latestDate {
  font-weight: 500;
  color: var(--text-tertiary);
}

.latestValue {
  font-size: 1.1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.weeklyCard {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--accent-soft), var(--surface) 60%);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.weeklyHeader {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.weeklyTitle {
  font-size: 0.95rem;
  font-weight: 800;
}

.weeklyTarget {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.weeklyValue {
  font-size: 1.3rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.weeklyResult {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--foreground);
}

.weeklyPending {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.historyCard {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.historyList {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.historyRow {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.historyDraw {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  min-width: 3.2rem;
}

.historyValue {
  font-size: 0.9rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.historyResult {
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
}
```

- [ ] **Step 5: 타입체크 + 전체 테스트 확인**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 통과

- [ ] **Step 6: Commit**

```bash
git add frontend/app/pension/page.tsx frontend/app/pension/page.module.css
git commit -m "Add recent draw, weekly pick, and history sections to /pension"
```

---

## 배포 참고사항 (이 플랜 밖의 수동 작업)

**`0012_create_pension_weekly_picks.sql`을 Supabase에 먼저 적용한 뒤에 배포**해야 한다 (`spring.jpa.hibernate.ddl-auto=validate` 설정 때문에 순서가 바뀌면 스키마 검증 실패로 백엔드 전체가 기동하지 않음 — 이전 단계들과 동일한 주의사항).

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서의 새 테이블/엔티티(Task 1), 서비스(Task 2), 엔드포인트(Task 3), 최근 당첨번호 조회 엔드포인트(Task 4), 프론트 lib(Task 5), `/pension` 페이지 세 섹션(Task 6) 전부 태스크로 반영됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 없음 — 전 스텝에 실제 코드/명령어 포함.
- **타입 일관성:** `PensionWeeklyPickResult`의 11개 필드 순서(Task 2에서 정의: `weekStart, targetDrawNo, groupNo, number, resultAvailable, rank, bonusMatch, actualGroupNo, actualNumber, actualBonusNumber, actualDrawDate`)가 프론트 `PensionWeeklyPickResult` interface(Task 5)의 필드 이름/타입과 정확히 일치함을 확인함. `PensionDrawResponse`(Task 4, 백엔드)의 필드 이름(`drawNo, drawDate, groupNo, number, bonusNumber`)이 프론트 `PensionDrawResult`(Task 5)와 정확히 일치함을 확인함.
- **기존 코드 영향 범위 확인:** `PensionNumberGenerationService`(2단계)와 `PensionMatchCalculator`(4단계)는 이 플랜에서 전혀 수정하지 않음 — 두 서비스 모두 기존 시그니처 그대로 호출만 함. `PensionDrawRepository`에는 메서드 하나만 추가되고 기존 `findMaxDrawNo()`는 그대로라 1~4단계에서 이를 사용하는 `PensionCrawlerService`/`PensionSavedNumberService`/`PensionGenerateController` 등에 영향 없음. `/pension` 페이지의 기존 뽑기 버튼/애니메이션/결과 카드 로직(4단계 이전에 만든 부분)은 전혀 수정하지 않고 그 위에 세 섹션만 추가함 — 로그인 게이트 로직과 독립적으로 항상 fetch되도록 설계해서 기존 로그인 분기(`{!auth ? ... : ...}`)를 건드릴 필요가 없었음.
