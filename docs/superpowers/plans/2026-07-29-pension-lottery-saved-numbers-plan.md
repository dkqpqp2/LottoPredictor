# 연금복권720+ 저장/마이페이지 매칭 (4단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연금복권720+ 뽑기 결과를 자동으로 저장하고, 동행복권 공식 등수 규칙(1~7등 + 보너스)에 따라 실제 추첨 결과와 비교해 `/mypage`에 보여준다.

**Architecture:** 새 패키지 `com.lottopredictor.backend.pensionsavednumber`에 `PensionSavedNumber` 엔티티 + 저장소 + 서비스 + 응답 DTO를 만들고, `com.lottopredictor.backend.pensiondraw` 패키지에 순수 매칭 로직 `PensionMatchCalculator`를 추가한다. `GET /api/pension/generate`가 번호 생성과 동시에 저장까지 한 요청 안에서 처리하도록 수정하고, `GET /api/pension/saved-numbers`(조회 전용)를 새로 추가한다. 프론트는 `lib/pensionSavedNumbers.ts`로 목록을 가져와 `/mypage`에 새 섹션으로 표시한다.

**Tech Stack:** Spring Boot 4.1.0 (Java 21, Spring Data JPA), JUnit 5 + Mockito + AssertJ, Next.js 16 App Router + TypeScript, Vitest.

## Global Constraints

- `pension_saved_numbers` 테이블은 `saved_numbers`(로또)와 완전히 독립적이다 — `source` 컬럼이 없다 (연금복권 저장은 항상 `/api/pension/generate` 한 곳에서만 발생).
- 저장은 프론트가 별도로 호출하지 않는다. `GET /api/pension/generate`가 번호 생성과 저장을 같은 요청 안에서 원자적으로 처리한다. `PensionSavedNumberController`에는 `GET`만 있고 `POST`가 없다.
- `PensionNumberGenerationService`(2단계에서 만든 순수 난수 생성 서비스)는 이번 단계에서 전혀 수정하지 않는다 — 저장 로직은 `PensionSavedNumberService`에만 있다.
- 등수 판정은 동행복권 공식 규칙 그대로: 1등(조+6자리 전부 일치), 2등(조 무관, 6자리 전부 일치), 3~7등(뒤에서부터 연속 5/4/3/2/1자리 일치), 보너스(조 무관, 6자리 번호가 보너스번호와 전부 일치 — 등수와 독립적으로 동시 발생 가능).
- `number`/`bonusNumber`는 항상 정확히 6자 문자열이다 (생성 시 `%06d` 포맷, 크롤러 저장 시 `varchar(6) not null`) — 정수 변환 없이 문자열 그대로 비교한다.
- 엔티티/리포지토리/컨트롤러는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 (기존 `SavedNumber`/`SavedNumberRepository`/`SavedNumberController`도 동일) — 컴파일 확인 + 전체 테스트 스위트로 검증한다.
- `/mypage` 페이지 자체는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 — 타입체크(`tsc --noEmit`) + 브라우저 수동 확인으로 검증한다.

---

### Task 1: `PensionSavedNumber` 엔티티 + 리포지토리 + DB 마이그레이션

**Files:**
- Create: `db/migrations/0011_create_pension_saved_numbers.sql`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumber.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberRepository.java`

**Interfaces:**
- Consumes: 없음
- Produces: `PensionSavedNumber(Long userId, Integer targetDrawNo, Integer groupNo, String number, Instant savedAt)` 생성자 + `getId()`, `getTargetDrawNo()`, `getGroupNo()`, `getNumber()`, `getSavedAt()` 게터. `PensionSavedNumberRepository.findByUserIdOrderBySavedAtDesc(Long userId): List<PensionSavedNumber>` (JpaRepository 상속이라 `save()`, `findById()`도 사용 가능). Task 3이 이 엔티티/리포지토리를 그대로 사용한다.

이 태스크는 다른 태스크와 독립적이다. 엔티티/리포지토리/마이그레이션은 이 코드베이스 컨벤션상 전용 테스트가 없다 (기존 `SavedNumber`/`SavedNumberRepository`도 동일).

- [ ] **Step 1: DB 마이그레이션 작성**

`db/migrations/0011_create_pension_saved_numbers.sql`:

```sql
create table if not exists pension_saved_numbers (
  id bigserial primary key,
  user_id bigint not null,
  target_draw_no integer not null,
  group_no integer not null,
  number varchar(6) not null,
  saved_at timestamptz not null
);
```

- [ ] **Step 2: `PensionSavedNumber` 엔티티 작성**

`backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumber.java`:

```java
package com.lottopredictor.backend.pensionsavednumber;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "pension_saved_numbers")
public class PensionSavedNumber {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "target_draw_no", nullable = false)
    private Integer targetDrawNo;

    @Column(name = "group_no", nullable = false)
    private Integer groupNo;

    @Column(name = "number", nullable = false)
    private String number;

    @Column(name = "saved_at", nullable = false)
    private Instant savedAt;

    protected PensionSavedNumber() {
    }

    public PensionSavedNumber(Long userId, Integer targetDrawNo, Integer groupNo, String number, Instant savedAt) {
        this.userId = userId;
        this.targetDrawNo = targetDrawNo;
        this.groupNo = groupNo;
        this.number = number;
        this.savedAt = savedAt;
    }

    public Long getId() {
        return id;
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

    public Instant getSavedAt() {
        return savedAt;
    }
}
```

- [ ] **Step 3: `PensionSavedNumberRepository` 작성**

`backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberRepository.java`:

```java
package com.lottopredictor.backend.pensionsavednumber;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PensionSavedNumberRepository extends JpaRepository<PensionSavedNumber, Long> {

    List<PensionSavedNumber> findByUserIdOrderBySavedAtDesc(Long userId);
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava compileTestJava`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0011_create_pension_saved_numbers.sql backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumber.java backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberRepository.java
git commit -m "Add PensionSavedNumber entity and repository"
```

---

### Task 2: `PensionMatchCalculator` (실제 동행복권 등수 규칙)

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionMatchCalculator.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/pensiondraw/PensionMatchCalculatorTest.java`

**Interfaces:**
- Consumes: 기존 `PensionDraw`(`getGroupNo(): Integer`, `getNumber(): String`, `getBonusNumber(): String`)
- Produces: `PensionMatchCalculator.MatchResult(String rank, boolean bonusMatch)` record, `PensionMatchCalculator.calculate(int pickedGroupNo, String pickedNumber, PensionDraw draw): MatchResult`. Task 3이 이 계산기를 그대로 사용한다.

이 태스크는 다른 모든 태스크와 독립적이다 (기존 `PensionDraw`만 사용).

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/pensiondraw/PensionMatchCalculatorTest.java`:

```java
package com.lottopredictor.backend.pensiondraw;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PensionMatchCalculatorTest {

    private static final LocalDate DRAW_DATE = LocalDate.of(2026, 7, 23);

    @Test
    void reportsFirstPrizeWhenGroupAndAllSixDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "123456", draw);

        assertThat(result.rank()).isEqualTo("1등");
        assertThat(result.bonusMatch()).isFalse();
    }

    @Test
    void reportsSecondPrizeWhenAllSixDigitsMatchButGroupDiffers() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(1, "123456", draw);

        assertThat(result.rank()).isEqualTo("2등");
    }

    @Test
    void reportsThirdPrizeWhenLastFiveDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "223456", draw);

        assertThat(result.rank()).isEqualTo("3등");
    }

    @Test
    void reportsFourthPrizeWhenLastFourDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "213456", draw);

        assertThat(result.rank()).isEqualTo("4등");
    }

    @Test
    void reportsFifthPrizeWhenLastThreeDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "124456", draw);

        assertThat(result.rank()).isEqualTo("5등");
    }

    @Test
    void reportsSixthPrizeWhenLastTwoDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "123356", draw);

        assertThat(result.rank()).isEqualTo("6등");
    }

    @Test
    void reportsSeventhPrizeWhenLastDigitMatches() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "123446", draw);

        assertThat(result.rank()).isEqualTo("7등");
    }

    @Test
    void reportsNoRankWhenLastDigitDiffers() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "123457", draw);

        assertThat(result.rank()).isNull();
    }

    @Test
    void reportsBonusMatchIndependentlyOfTheMainRank() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "999456");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(1, "999456", draw);

        assertThat(result.rank()).isEqualTo("5등");
        assertThat(result.bonusMatch()).isTrue();
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.pensiondraw.PensionMatchCalculatorTest"`
Expected: FAIL — 컴파일 에러 (`PensionMatchCalculator` 클래스가 아직 없음)

- [ ] **Step 3: `PensionMatchCalculator` 구현 작성**

`backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionMatchCalculator.java`:

```java
package com.lottopredictor.backend.pensiondraw;

public final class PensionMatchCalculator {

    private PensionMatchCalculator() {
    }

    public record MatchResult(String rank, boolean bonusMatch) {
    }

    public static MatchResult calculate(int pickedGroupNo, String pickedNumber, PensionDraw draw) {
        int suffixLen = commonSuffixLength(pickedNumber, draw.getNumber());
        String rank;
        if (suffixLen == 6) {
            rank = pickedGroupNo == draw.getGroupNo() ? "1등" : "2등";
        } else {
            rank = switch (suffixLen) {
                case 5 -> "3등";
                case 4 -> "4등";
                case 3 -> "5등";
                case 2 -> "6등";
                case 1 -> "7등";
                default -> null;
            };
        }
        boolean bonusMatch = pickedNumber.equals(draw.getBonusNumber());
        return new MatchResult(rank, bonusMatch);
    }

    private static int commonSuffixLength(String a, String b) {
        int len = 0;
        for (int i = 1; i <= 6; i++) {
            if (a.charAt(6 - i) == b.charAt(6 - i)) {
                len++;
            } else {
                break;
            }
        }
        return len;
    }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.pensiondraw.PensionMatchCalculatorTest"`
Expected: `BUILD SUCCESSFUL`, 9개 테스트 전부 통과

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionMatchCalculator.java backend/src/test/java/com/lottopredictor/backend/pensiondraw/PensionMatchCalculatorTest.java
git commit -m "Add PensionMatchCalculator implementing the official prize-tier rules"
```

---

### Task 3: `PensionSavedNumberResponse` + `PensionSavedNumberService`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `PensionSavedNumber`/`PensionSavedNumberRepository`, Task 2의 `PensionMatchCalculator`, 기존 `PensionDraw`/`PensionDrawRepository`
- Produces: `PensionSavedNumberResponse(Long id, int targetDrawNo, int groupNo, String number, Instant savedAt, boolean resultAvailable, String rank, Boolean bonusMatch, Integer actualGroupNo, String actualNumber, String actualBonusNumber, String actualDrawDate)` record. `PensionSavedNumberService.save(Long userId, int groupNo, String number): PensionSavedNumberResponse`, `PensionSavedNumberService.getSaved(Long userId): List<PensionSavedNumberResponse>`. Task 4가 이 서비스를 그대로 사용한다.

이 태스크는 Task 1, Task 2에 의존한다.

- [ ] **Step 1: `PensionSavedNumberResponse` 작성**

`backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberResponse.java`:

```java
package com.lottopredictor.backend.pensionsavednumber;

import java.time.Instant;

public record PensionSavedNumberResponse(
        Long id,
        int targetDrawNo,
        int groupNo,
        String number,
        Instant savedAt,
        boolean resultAvailable,
        String rank,
        Boolean bonusMatch,
        Integer actualGroupNo,
        String actualNumber,
        String actualBonusNumber,
        String actualDrawDate
) {
    public static PensionSavedNumberResponse pending(
            Long id, int targetDrawNo, int groupNo, String number, Instant savedAt
    ) {
        return new PensionSavedNumberResponse(
                id, targetDrawNo, groupNo, number, savedAt, false, null, null, null, null, null, null
        );
    }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberServiceTest.java`:

```java
package com.lottopredictor.backend.pensionsavednumber;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PensionSavedNumberServiceTest {

    @Mock
    private PensionSavedNumberRepository pensionSavedNumberRepository;

    @Mock
    private PensionDrawRepository pensionDrawRepository;

    @Test
    void saveComputesTheNextDrawNoAndPersistsThePick() {
        when(pensionDrawRepository.findMaxDrawNo()).thenReturn(Optional.of(325));
        when(pensionSavedNumberRepository.save(any(PensionSavedNumber.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pensionDrawRepository.findById(326)).thenReturn(Optional.empty());

        PensionSavedNumberService service =
                new PensionSavedNumberService(pensionSavedNumberRepository, pensionDrawRepository);
        PensionSavedNumberResponse response = service.save(1L, 3, "011391");

        assertThat(response.targetDrawNo()).isEqualTo(326);
        assertThat(response.groupNo()).isEqualTo(3);
        assertThat(response.number()).isEqualTo("011391");
        assertThat(response.resultAvailable()).isFalse();
    }

    @Test
    void saveDefaultsTheTargetDrawNoToOneWhenNoDrawsExistYet() {
        when(pensionDrawRepository.findMaxDrawNo()).thenReturn(Optional.empty());
        when(pensionSavedNumberRepository.save(any(PensionSavedNumber.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pensionDrawRepository.findById(1)).thenReturn(Optional.empty());

        PensionSavedNumberService service =
                new PensionSavedNumberService(pensionSavedNumberRepository, pensionDrawRepository);
        PensionSavedNumberResponse response = service.save(1L, 2, "485216");

        assertThat(response.targetDrawNo()).isEqualTo(1);
    }

    @Test
    void getSavedReturnsAllSavedPicksForTheUserMostRecentFirst() {
        PensionSavedNumber existing = new PensionSavedNumber(1L, 326, 3, "011391", Instant.now());
        when(pensionSavedNumberRepository.findByUserIdOrderBySavedAtDesc(1L)).thenReturn(List.of(existing));
        when(pensionDrawRepository.findById(326)).thenReturn(Optional.empty());

        PensionSavedNumberService service =
                new PensionSavedNumberService(pensionSavedNumberRepository, pensionDrawRepository);
        List<PensionSavedNumberResponse> result = service.getSaved(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).groupNo()).isEqualTo(3);
        assertThat(result.get(0).number()).isEqualTo("011391");
        assertThat(result.get(0).resultAvailable()).isFalse();
    }

    @Test
    void getSavedReportsRankAndBonusOnceTheTargetDrawIsResolved() {
        PensionSavedNumber existing = new PensionSavedNumber(1L, 325, 3, "011391", Instant.now());
        when(pensionSavedNumberRepository.findByUserIdOrderBySavedAtDesc(1L)).thenReturn(List.of(existing));
        PensionDraw draw = new PensionDraw(325, LocalDate.of(2026, 7, 23), 3, "011391", "438906");
        when(pensionDrawRepository.findById(325)).thenReturn(Optional.of(draw));

        PensionSavedNumberService service =
                new PensionSavedNumberService(pensionSavedNumberRepository, pensionDrawRepository);
        List<PensionSavedNumberResponse> result = service.getSaved(1L);

        PensionSavedNumberResponse response = result.get(0);
        assertThat(response.resultAvailable()).isTrue();
        assertThat(response.rank()).isEqualTo("1등");
        assertThat(response.bonusMatch()).isFalse();
        assertThat(response.actualGroupNo()).isEqualTo(3);
        assertThat(response.actualNumber()).isEqualTo("011391");
        assertThat(response.actualBonusNumber()).isEqualTo("438906");
        assertThat(response.actualDrawDate()).isEqualTo("2026-07-23");
    }
}
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.pensionsavednumber.PensionSavedNumberServiceTest"`
Expected: FAIL — 컴파일 에러 (`PensionSavedNumberService` 클래스가 아직 없음)

- [ ] **Step 4: `PensionSavedNumberService` 구현 작성**

`backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberService.java`:

```java
package com.lottopredictor.backend.pensionsavednumber;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import com.lottopredictor.backend.pensiondraw.PensionMatchCalculator;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class PensionSavedNumberService {

    private final PensionSavedNumberRepository pensionSavedNumberRepository;
    private final PensionDrawRepository pensionDrawRepository;

    public PensionSavedNumberService(
            PensionSavedNumberRepository pensionSavedNumberRepository,
            PensionDrawRepository pensionDrawRepository
    ) {
        this.pensionSavedNumberRepository = pensionSavedNumberRepository;
        this.pensionDrawRepository = pensionDrawRepository;
    }

    public PensionSavedNumberResponse save(Long userId, int groupNo, String number) {
        int targetDrawNo = pensionDrawRepository.findMaxDrawNo().orElse(0) + 1;
        PensionSavedNumber entity = new PensionSavedNumber(userId, targetDrawNo, groupNo, number, Instant.now());
        return toResponse(pensionSavedNumberRepository.save(entity));
    }

    public List<PensionSavedNumberResponse> getSaved(Long userId) {
        return pensionSavedNumberRepository.findByUserIdOrderBySavedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private PensionSavedNumberResponse toResponse(PensionSavedNumber entity) {
        return pensionDrawRepository.findById(entity.getTargetDrawNo())
                .map(draw -> buildAvailableResponse(entity, draw))
                .orElseGet(() -> PensionSavedNumberResponse.pending(
                        entity.getId(), entity.getTargetDrawNo(), entity.getGroupNo(), entity.getNumber(), entity.getSavedAt()
                ));
    }

    private PensionSavedNumberResponse buildAvailableResponse(PensionSavedNumber entity, PensionDraw draw) {
        PensionMatchCalculator.MatchResult match =
                PensionMatchCalculator.calculate(entity.getGroupNo(), entity.getNumber(), draw);

        return new PensionSavedNumberResponse(
                entity.getId(),
                entity.getTargetDrawNo(),
                entity.getGroupNo(),
                entity.getNumber(),
                entity.getSavedAt(),
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

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.pensionsavednumber.PensionSavedNumberServiceTest"`
Expected: `BUILD SUCCESSFUL`, 4개 테스트 전부 통과

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberResponse.java backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberService.java backend/src/test/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberServiceTest.java
git commit -m "Add PensionSavedNumberService with pending/available response mapping"
```

---

### Task 4: `PensionGenerateController` 수정 (원자적 저장) + `PensionSavedNumberController`

**Files:**
- Modify: `backend/src/main/java/com/lottopredictor/backend/api/PensionGenerateController.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/api/PensionSavedNumberController.java`

**Interfaces:**
- Consumes: Task 3의 `PensionSavedNumberService.save(Long, int, String)`, `PensionSavedNumberService.getSaved(Long)`, `PensionSavedNumberResponse`
- Produces: 없음 (이 플랜의 마지막 백엔드 태스크)

이 태스크는 Task 3에 의존한다. 컨트롤러는 이 코드베이스 컨벤션상 전용 테스트가 없다 — 컴파일 확인 + 전체 테스트 스위트로 검증한다.

- [ ] **Step 1: `PensionGenerateController` 수정**

`backend/src/main/java/com/lottopredictor/backend/api/PensionGenerateController.java` 전체를 다음으로 교체:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.pensiongenerate.PensionGenerateResult;
import com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationService;
import com.lottopredictor.backend.pensionsavednumber.PensionSavedNumberService;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PensionGenerateController {

    private final PensionNumberGenerationService service;
    private final UsageService usageService;
    private final PensionSavedNumberService pensionSavedNumberService;

    public PensionGenerateController(
            PensionNumberGenerationService service,
            UsageService usageService,
            PensionSavedNumberService pensionSavedNumberService
    ) {
        this.service = service;
        this.usageService = usageService;
        this.pensionSavedNumberService = pensionSavedNumberService;
    }

    @GetMapping("/api/pension/generate")
    public ResponseEntity<PensionGenerateResult> generate(@AuthPrincipal AuthenticatedUser principal) {
        if (!usageService.consume(principal.userId(), Feature.PENSION)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        PensionGenerateResult result = service.generate();
        pensionSavedNumberService.save(principal.userId(), result.groupNo(), result.number());
        return ResponseEntity.ok(result);
    }
}
```

- [ ] **Step 2: `PensionSavedNumberController` 작성**

`backend/src/main/java/com/lottopredictor/backend/api/PensionSavedNumberController.java`:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.pensionsavednumber.PensionSavedNumberResponse;
import com.lottopredictor.backend.pensionsavednumber.PensionSavedNumberService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class PensionSavedNumberController {

    private final PensionSavedNumberService pensionSavedNumberService;

    public PensionSavedNumberController(PensionSavedNumberService pensionSavedNumberService) {
        this.pensionSavedNumberService = pensionSavedNumberService;
    }

    @GetMapping("/api/pension/saved-numbers")
    public List<PensionSavedNumberResponse> list(@AuthPrincipal AuthenticatedUser principal) {
        return pensionSavedNumberService.getSaved(principal.userId());
    }
}
```

- [ ] **Step 3: 전체 빌드 확인**

Run: `cd backend && ./gradlew test`
Expected: `BUILD SUCCESSFUL`, 전체 테스트 통과 (기존 테스트 + 이 플랜에서 추가한 테스트 전부)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/api/PensionGenerateController.java backend/src/main/java/com/lottopredictor/backend/api/PensionSavedNumberController.java
git commit -m "Save pension picks atomically on generate and expose GET /api/pension/saved-numbers"
```

---

### Task 5: 프론트 `lib/pensionSavedNumbers.ts`

**Files:**
- Create: `frontend/lib/pensionSavedNumbers.ts`
- Test: `frontend/lib/pensionSavedNumbers.test.ts`

**Interfaces:**
- Consumes: 없음 (Task 4의 `GET /api/pension/saved-numbers` 응답 형태를 문서/스펙 기준으로 그대로 타이핑함)
- Produces: `PensionSavedNumberResult` interface, `getPensionSavedNumbers(token: string): Promise<PensionSavedNumberResult[]>`. Task 6이 이 타입과 함수를 그대로 사용한다.

이 태스크는 코드 의존성 없이 독립적으로 작성 가능하다 (백엔드가 이미 이 응답 형태로 동작한다는 전제만 필요).

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/pensionSavedNumbers.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPensionSavedNumbers } from "./pensionSavedNumbers";

describe("getPensionSavedNumbers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the saved list on success", async () => {
    const payload = [
      {
        id: 1,
        targetDrawNo: 326,
        groupNo: 3,
        number: "011391",
        savedAt: "2026-07-29T10:00:00Z",
        resultAvailable: false,
        rank: null,
        bonusMatch: null,
        actualGroupNo: null,
        actualNumber: null,
        actualBonusNumber: null,
        actualDrawDate: null,
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getPensionSavedNumbers("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("returns rank and bonus info when the target draw is resolved", async () => {
    const payload = [
      {
        id: 1,
        targetDrawNo: 325,
        groupNo: 3,
        number: "011391",
        savedAt: "2026-07-29T10:00:00Z",
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

    const result = await getPensionSavedNumbers("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getPensionSavedNumbers("jwt-abc")).rejects.toThrow(
      "저장된 연금복권 번호를 불러오지 못했습니다."
    );
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/pensionSavedNumbers.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음 (`./pensionSavedNumbers`가 아직 없음)

- [ ] **Step 3: `lib/pensionSavedNumbers.ts` 작성**

`frontend/lib/pensionSavedNumbers.ts`:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export interface PensionSavedNumberResult {
  id: number;
  targetDrawNo: number;
  groupNo: number;
  number: string;
  savedAt: string;
  resultAvailable: boolean;
  rank: string | null;
  bonusMatch: boolean | null;
  actualGroupNo: number | null;
  actualNumber: string | null;
  actualBonusNumber: string | null;
  actualDrawDate: string | null;
}

export async function getPensionSavedNumbers(token: string): Promise<PensionSavedNumberResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/pension/saved-numbers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("저장된 연금복권 번호를 불러오지 못했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/pensionSavedNumbers.test.ts`
Expected: 3개 테스트 전부 통과

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/pensionSavedNumbers.ts frontend/lib/pensionSavedNumbers.test.ts
git commit -m "Add lib/pensionSavedNumbers.ts"
```

---

### Task 6: `/mypage`에 "연금복권 뽑은 번호" 섹션 추가

**Files:**
- Modify: `frontend/app/mypage/page.tsx`
- Modify: `frontend/app/mypage/page.module.css`

**Interfaces:**
- Consumes: Task 5의 `getPensionSavedNumbers`, `PensionSavedNumberResult`
- Produces: 없음 (이 플랜의 마지막 태스크)

이 태스크는 Task 5에 의존한다. `/mypage` 페이지는 이 코드베이스 컨벤션상 전용 테스트가 없다 — 타입체크 + 브라우저 수동 확인으로 검증한다.

- [ ] **Step 1: import 및 state 추가**

`frontend/app/mypage/page.tsx`에서 다음 import 줄:

```tsx
import { getSavedNumbers, type SavedNumberResult } from "../../lib/savedNumbers";
```

바로 아래에 추가:

```tsx
import { getPensionSavedNumbers, type PensionSavedNumberResult } from "../../lib/pensionSavedNumbers";
```

`const [error, setError] = useState<string | null>(null);` 바로 아래에 추가:

```tsx
  const [pensionSavedNumbers, setPensionSavedNumbers] = useState<PensionSavedNumberResult[]>([]);
  const [pensionError, setPensionError] = useState<string | null>(null);
```

`const [interpretationPage, setInterpretationPage] = useState(0);` 바로 아래에 추가:

```tsx
  const [pensionPage, setPensionPage] = useState(0);
```

- [ ] **Step 2: 데이터 불러오기 + 월 이동 시 페이지 리셋**

기존 `useEffect` 블록:

```tsx
  useEffect(() => {
    if (!auth) return;
    getSavedNumbers(auth.token)
      .then(setSavedNumbers)
      .catch(() => setError("저장된 번호를 불러오지 못했습니다."));
    getTarotInterpretationHistory(auth.token)
      .then(setInterpretations)
      .catch(() => setInterpretationsError("타로 해석 기록을 불러오지 못했습니다."));
  }, [auth]);
```

를 다음으로 교체:

```tsx
  useEffect(() => {
    if (!auth) return;
    getSavedNumbers(auth.token)
      .then(setSavedNumbers)
      .catch(() => setError("저장된 번호를 불러오지 못했습니다."));
    getTarotInterpretationHistory(auth.token)
      .then(setInterpretations)
      .catch(() => setInterpretationsError("타로 해석 기록을 불러오지 못했습니다."));
    getPensionSavedNumbers(auth.token)
      .then(setPensionSavedNumbers)
      .catch(() => setPensionError("저장된 연금복권 번호를 불러오지 못했습니다."));
  }, [auth]);
```

`handlePrevMonth`/`handleNextMonth` 함수의 다음 줄:

```tsx
    setNumberPage(0);
    setInterpretationPage(0);
```

두 곳(각 함수 안에 한 번씩) 모두 다음으로 교체:

```tsx
    setNumberPage(0);
    setInterpretationPage(0);
    setPensionPage(0);
```

- [ ] **Step 3: 월별 필터링/페이지네이션 계산 + 핸들러 추가**

`const totalNumberPages = ...` 및 `const pagedItems = ...` 계산부 바로 아래(그리고 `handleNextInterpretationPage` 함수 정의 다음)에 추가:

```tsx
  const monthPensionItems = pensionSavedNumbers.filter((item) => {
    const d = new Date(item.savedAt);
    return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth;
  });
  const totalPensionPages = Math.max(1, Math.ceil(monthPensionItems.length / NUMBERS_PER_PAGE));
  const pagedPensionItems = monthPensionItems.slice(
    pensionPage * NUMBERS_PER_PAGE,
    pensionPage * NUMBERS_PER_PAGE + NUMBERS_PER_PAGE
  );

  function handlePrevPensionPage() {
    setPensionPage((p) => Math.max(0, p - 1));
  }

  function handleNextPensionPage() {
    setPensionPage((p) => Math.min(totalPensionPages - 1, p + 1));
  }
```

- [ ] **Step 4: 월 네비게이션 표시 조건에 연금복권 포함**

다음 줄:

```tsx
      {(savedNumbers.length > 0 || interpretations.length > 0) && (
```

를 다음으로 교체:

```tsx
      {(savedNumbers.length > 0 || interpretations.length > 0 || pensionSavedNumbers.length > 0) && (
```

- [ ] **Step 5: "연금복권 뽑은 번호" 섹션 렌더링 추가**

"저장한 번호" 섹션(`{!error && savedNumbers.length > 0 && ( ... )}` 블록)이 끝나는 닫는 태그 바로 다음, 컴포넌트의 최종 반환 `</div>` 이전에 추가:

```tsx
      {pensionError && <p className={styles.error}>{pensionError}</p>}

      {!pensionError && pensionSavedNumbers.length === 0 && (
        <p className={styles.empty}>아직 뽑은 연금복권 번호가 없어요.</p>
      )}

      {!pensionError && pensionSavedNumbers.length > 0 && (
        <div className={styles.monthGroup}>
          <h2 className={styles.monthLabel}>연금복권 뽑은 번호</h2>
          {pagedPensionItems.length === 0 ? (
            <p className={styles.empty}>이 달에는 뽑은 연금복권 번호가 없어요.</p>
          ) : (
            <>
              <div className={styles.itemList}>
                {pagedPensionItems.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <span className={styles.pensionNumber}>
                      {item.groupNo}조 {item.number}
                    </span>
                    <span className={styles.itemMeta}>
                      {item.targetDrawNo}회 대상 · {new Date(item.savedAt).toLocaleDateString("ko-KR")}
                      {item.resultAvailable &&
                        ` · 당첨 ${item.actualGroupNo}조 ${item.actualNumber} · ${
                          item.rank ? item.rank : "낙첨"
                        }${item.bonusMatch ? " · 보너스 당첨" : ""}`}
                    </span>
                  </div>
                ))}
              </div>

              {totalPensionPages > 1 && (
                <div className={styles.pager}>
                  <button
                    type="button"
                    className={styles.monthNavArrow}
                    onClick={handlePrevPensionPage}
                    disabled={pensionPage === 0}
                    aria-label="이전 페이지"
                  >
                    ‹
                  </button>
                  <span className={styles.pagerCount}>
                    {pensionPage + 1} / {totalPensionPages}
                  </span>
                  <button
                    type="button"
                    className={styles.monthNavArrow}
                    onClick={handleNextPensionPage}
                    disabled={pensionPage >= totalPensionPages - 1}
                    aria-label="다음 페이지"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
```

- [ ] **Step 6: CSS 클래스 추가**

`frontend/app/mypage/page.module.css` 맨 끝에 추가:

```css
.pensionNumber {
  font-size: 0.95rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 7: 타입체크 + 전체 테스트 확인**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 통과

- [ ] **Step 8: Commit**

```bash
git add frontend/app/mypage/page.tsx frontend/app/mypage/page.module.css
git commit -m "Add pension saved-numbers section to /mypage"
```

---

## 배포 참고사항 (이 플랜 밖의 수동 작업)

**`0011_create_pension_saved_numbers.sql`을 Supabase에 먼저 적용한 뒤에 배포**해야 한다 (`spring.jpa.hibernate.ddl-auto=validate` 설정 때문에 순서가 바뀌면 스키마 검증 실패로 백엔드 전체가 기동하지 않음 — 1단계와 동일한 주의사항).

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서의 새 테이블/엔티티(Task 1), 실제 등수 규칙 매칭 로직(Task 2), 응답 DTO + 서비스(Task 3), 원자적 저장 + 조회 엔드포인트(Task 4), 프론트 lib(Task 5), `/mypage` 섹션(Task 6) 전부 태스크로 반영됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 없음 — 전 스텝에 실제 코드/명령어 포함.
- **타입 일관성:** `PensionSavedNumberResponse`의 12개 필드 순서(Task 3에서 정의: `id, targetDrawNo, groupNo, number, savedAt, resultAvailable, rank, bonusMatch, actualGroupNo, actualNumber, actualBonusNumber, actualDrawDate`)가 프론트 `PensionSavedNumberResult` interface(Task 5)의 필드 순서/이름과 정확히 일치함을 확인함. `PensionMatchCalculator.MatchResult(rank, bonusMatch)`(Task 2)가 Task 3의 `buildAvailableResponse`에서 그대로 사용됨.
- **기존 코드 영향 범위 확인:** `PensionNumberGenerationService`(2단계)는 이 플랜에서 전혀 수정하지 않음 — grep으로 `pensiongenerate` 패키지가 이 플랜의 어떤 파일에서도 수정 대상이 아님을 확인함. `SavedNumber`/`SavedNumberService`/`SavedNumberController`(로또 저장)도 전혀 건드리지 않음 — `pension_saved_numbers`는 완전히 별도 테이블/서비스다. `/mypage` 기존 "저장한 번호"/"타로 해석 기록" 섹션의 JSX/상태는 Task 6에서 그대로 유지되고, 새 섹션만 추가됨(월 네비게이션 표시 조건 한 줄만 예외적으로 수정).
