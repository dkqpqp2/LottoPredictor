# 연금복권720+ 번호 생성 + 진행도 연동 (2단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연금복권720+ 번호를 완전 랜덤으로 생성하는 백엔드 기능과, 등급 무관 하루 1회 고정의 진행도/횟수 연동을 추가한다.

**Architecture:** `Feature` enum에 `PENSION`을 추가하고 `TierPolicy`에 등급 무관 고정 1회 제한을 넣는다. 새 `pensiongenerate` 패키지에 `PensionDrawRepository`(1단계 크롤러 데이터)에 의존하지 않는 순수 랜덤 생성 서비스를 만들고, 기존 `GenerateController`와 같은 패턴으로 `/api/pension/generate` 엔드포인트를 노출한다. `ProgressResponse`에 `pensionUsage`를 추가해 마이페이지/진행도 표시가 연금복권 사용 현황도 담을 수 있게 한다.

**Tech Stack:** Spring Boot 4.1.0 (Java 21, Spring Data JPA), JUnit 5 + Mockito + AssertJ.

## Global Constraints

- 연금복권 번호 생성은 완전 랜덤만 지원한다 (통계 기반 가중치 모드 없음) — 조 1~5, 6자리 번호 000000~999999, 항상 1개만 생성("세트" 개념 없음).
- `PensionNumberGenerationService`는 `PensionDrawRepository`(1단계 크롤링 데이터)에 전혀 의존하지 않는다 — 순수 독립 난수 생성이다.
- 연금복권 하루 사용 제한은 등급과 무관하게 항상 1회다 (로또/타로처럼 등급별로 늘어나지 않음).
- `DailyUsage.feature` 컬럼은 이미 `@Enumerated(EnumType.STRING)`으로 문자열 저장되므로, `Feature` enum에 `PENSION`을 추가해도 DB 마이그레이션이 필요 없다.
- `ProgressResponse`를 직접 생성(`new ProgressResponse(...)`)하는 곳은 `UsageService.getProgress()` 한 곳뿐이다 — 필드 추가 시 그 한 곳만 고치면 된다.
- 컨트롤러는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 (기존 `GenerateController`도 동일) — 컴파일 확인 + 전체 테스트 스위트로 검증한다.

---

### Task 1: `Feature.PENSION` + `TierPolicy` 등급 무관 1회 제한

**Files:**
- Modify: `backend/src/main/java/com/lottopredictor/backend/progress/Feature.java`
- Modify: `backend/src/main/java/com/lottopredictor/backend/progress/TierPolicy.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/progress/TierPolicyTest.java`

**Interfaces:**
- Consumes: 없음
- Produces: `Feature.PENSION` enum 상수. `TierPolicy.dailyLimit(Tier, Feature.PENSION)`이 모든 등급에서 `1`을 반환. Task 3(`UsageService`)과 Task 4(`PensionGenerateController`)가 이 enum 값과 동작을 그대로 사용한다.

이 태스크는 다른 태스크와 독립적이다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/progress/TierPolicyTest.java` 맨 끝(마지막 `}` 앞)에 추가:

```java
    @Test
    void pensionIsCappedAtOnePerDayForEveryTierIncludingLottoGod() {
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.PENSION)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.APPRENTICE, Feature.PENSION)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.EXPERT, Feature.PENSION)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.PENSION)).isEqualTo(1);
    }
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.progress.TierPolicyTest"`
Expected: FAIL — 컴파일 에러 (`Feature.PENSION`이 아직 존재하지 않음)

- [ ] **Step 3: `Feature` enum에 `PENSION` 추가**

`backend/src/main/java/com/lottopredictor/backend/progress/Feature.java` 전체를 다음으로 교체:

```java
package com.lottopredictor.backend.progress;

public enum Feature {
    TAROT,
    GENERATE,
    PENSION
}
```

- [ ] **Step 4: `TierPolicy.dailyLimit()`에 `PENSION` 특수 케이스 추가**

`backend/src/main/java/com/lottopredictor/backend/progress/TierPolicy.java`에서:

```java
    public static int dailyLimit(Tier tier, Feature feature) {
        DailyLimits limits = DAILY_LIMITS.get(tier);
        return feature == Feature.TAROT ? limits.tarot() : limits.generate();
    }
```

를 다음으로 교체:

```java
    public static int dailyLimit(Tier tier, Feature feature) {
        if (feature == Feature.PENSION) {
            return 1;
        }
        DailyLimits limits = DAILY_LIMITS.get(tier);
        return feature == Feature.TAROT ? limits.tarot() : limits.generate();
    }
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.progress.TierPolicyTest"`
Expected: `BUILD SUCCESSFUL`, 전부 통과

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/progress/Feature.java backend/src/main/java/com/lottopredictor/backend/progress/TierPolicy.java backend/src/test/java/com/lottopredictor/backend/progress/TierPolicyTest.java
git commit -m "Add PENSION feature capped at one use per day for every tier"
```

---

### Task 2: `PensionNumberGenerationService` (완전 랜덤 생성)

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/pensiongenerate/PensionGenerateResult.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensiongenerate/PensionNumberGenerationService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/pensiongenerate/PensionNumberGenerationServiceTest.java`

**Interfaces:**
- Consumes: 없음 (다른 태스크의 어떤 타입에도 의존하지 않는다 — `PensionDrawRepository`에도 의존하지 않음, Global Constraints 참고)
- Produces: `PensionGenerateResult(int groupNo, String number)` record. `PensionNumberGenerationService.generate(): PensionGenerateResult`. Task 4(`PensionGenerateController`)가 이 서비스와 반환 타입을 그대로 사용한다.

이 태스크는 다른 모든 태스크와 독립적이다.

- [ ] **Step 1: `PensionGenerateResult` record 작성**

```java
package com.lottopredictor.backend.pensiongenerate;

public record PensionGenerateResult(int groupNo, String number) {
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/pensiongenerate/PensionNumberGenerationServiceTest.java`:

```java
package com.lottopredictor.backend.pensiongenerate;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PensionNumberGenerationServiceTest {

    @Test
    void generatesAGroupNumberBetweenOneAndFive() {
        PensionNumberGenerationService service = new PensionNumberGenerationService();
        for (int i = 0; i < 50; i++) {
            PensionGenerateResult result = service.generate();
            assertThat(result.groupNo()).isBetween(1, 5);
        }
    }

    @Test
    void generatesASixDigitZeroPaddedNumber() {
        PensionNumberGenerationService service = new PensionNumberGenerationService();
        for (int i = 0; i < 50; i++) {
            PensionGenerateResult result = service.generate();
            assertThat(result.number()).hasSize(6);
            assertThat(result.number()).matches("\\d{6}");
        }
    }

    @Test
    void isDeterministicAtTheLowerBoundaryGivenAFixedRng() {
        PensionNumberGenerationService service = new PensionNumberGenerationService();

        PensionGenerateResult result = service.generate(() -> 0.0);

        assertThat(result.groupNo()).isEqualTo(1);
        assertThat(result.number()).isEqualTo("000000");
    }

    @Test
    void isDeterministicAtTheUpperBoundaryGivenAFixedRng() {
        PensionNumberGenerationService service = new PensionNumberGenerationService();

        PensionGenerateResult result = service.generate(() -> 0.999999);

        assertThat(result.groupNo()).isEqualTo(5);
        assertThat(result.number()).isEqualTo("999999");
    }
}
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationServiceTest"`
Expected: FAIL — 컴파일 에러 (`PensionNumberGenerationService` 클래스가 아직 없음)

- [ ] **Step 4: `PensionNumberGenerationService` 구현 작성**

```java
package com.lottopredictor.backend.pensiongenerate;

import org.springframework.stereotype.Service;

import java.util.function.DoubleSupplier;

@Service
public class PensionNumberGenerationService {

    public PensionGenerateResult generate() {
        return generate(Math::random);
    }

    PensionGenerateResult generate(DoubleSupplier rng) {
        int groupNo = 1 + (int) (rng.getAsDouble() * 5);
        String number = String.format("%06d", (int) (rng.getAsDouble() * 1_000_000));
        return new PensionGenerateResult(groupNo, number);
    }
}
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationServiceTest"`
Expected: `BUILD SUCCESSFUL`, 4개 테스트 전부 통과

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/pensiongenerate/ backend/src/test/java/com/lottopredictor/backend/pensiongenerate/
git commit -m "Add PensionNumberGenerationService for fully-random pension picks"
```

---

### Task 3: `ProgressResponse` + `UsageService.getProgress()`에 `pensionUsage` 추가

**Files:**
- Modify: `backend/src/main/java/com/lottopredictor/backend/progress/ProgressResponse.java`
- Modify: `backend/src/main/java/com/lottopredictor/backend/progress/UsageService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/progress/UsageServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `Feature.PENSION`, `TierPolicy.dailyLimit(tier, Feature.PENSION)`
- Produces: `ProgressResponse.pensionUsage(): UsageInfo`. 이 필드는 이번 플랜 밖(3단계 프론트)에서 마이페이지/진행도 표시에 쓰인다.

이 태스크는 Task 1에 의존한다.

- [ ] **Step 1: `ProgressResponse`에 `pensionUsage` 필드 추가**

`backend/src/main/java/com/lottopredictor/backend/progress/ProgressResponse.java` 전체를 다음으로 교체:

```java
package com.lottopredictor.backend.progress;

public record ProgressResponse(
        String tier,
        int totalPoints,
        Integer pointsToNextTier,
        UsageInfo tarotUsage,
        UsageInfo generateUsage,
        UsageInfo pensionUsage,
        int maxSets,
        boolean adjustableSets,
        int tierFloor
) {
    public record UsageInfo(int used, int limit) {
    }
}
```

- [ ] **Step 2: 실패하는 테스트로 갱신**

`backend/src/test/java/com/lottopredictor/backend/progress/UsageServiceTest.java`의 `getProgressReportsTierPointsAndTodayUsage` 테스트를 찾아 다음으로 교체:

```java
    @Test
    void getProgressReportsTierPointsAndTodayUsage() {
        User user = newUser();
        user.addPoints(50);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(dailyUsageRepository.findByUserIdAndUsageDateAndFeature(eq(1L), any(LocalDate.class), eq(Feature.TAROT)))
                .thenReturn(Optional.of(new DailyUsage(1L, LocalDate.now(), Feature.TAROT, 1)));
        when(dailyUsageRepository.findByUserIdAndUsageDateAndFeature(eq(1L), any(LocalDate.class), eq(Feature.GENERATE)))
                .thenReturn(Optional.empty());
        when(dailyUsageRepository.findByUserIdAndUsageDateAndFeature(eq(1L), any(LocalDate.class), eq(Feature.PENSION)))
                .thenReturn(Optional.empty());

        UsageService service = new UsageService(userRepository, dailyUsageRepository);
        ProgressResponse progress = service.getProgress(1L);

        assertThat(progress.tier()).isEqualTo("뽑기 견습생");
        assertThat(progress.totalPoints()).isEqualTo(50);
        assertThat(progress.pointsToNextTier()).isEqualTo(100);
        assertThat(progress.tarotUsage()).isEqualTo(new ProgressResponse.UsageInfo(1, 1));
        assertThat(progress.generateUsage()).isEqualTo(new ProgressResponse.UsageInfo(0, 3));
        assertThat(progress.pensionUsage()).isEqualTo(new ProgressResponse.UsageInfo(0, 1));
        assertThat(progress.maxSets()).isEqualTo(3);
        assertThat(progress.adjustableSets()).isFalse();
        assertThat(progress.tierFloor()).isEqualTo(50);
    }
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.progress.UsageServiceTest"`
Expected: FAIL — 컴파일 에러 (`ProgressResponse.pensionUsage()`가 아직 없음, `UsageService.getProgress()`가 새 생성자 인자 개수와 맞지 않음)

- [ ] **Step 4: `UsageService.getProgress()`에 `pensionUsed` 계산/포함**

`backend/src/main/java/com/lottopredictor/backend/progress/UsageService.java`에서:

```java
    public ProgressResponse getProgress(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        Tier tier = TierPolicy.effectiveTier(user.getForcedTier(), user.getTotalPoints());
        LocalDate today = LocalDate.now(KST);
        int tarotUsed = usageCountFor(userId, today, Feature.TAROT);
        int generateUsed = usageCountFor(userId, today, Feature.GENERATE);
        return new ProgressResponse(
                tier.label(),
                user.getTotalPoints(),
                TierPolicy.pointsToNextTier(tier, user.getTotalPoints()),
                new ProgressResponse.UsageInfo(tarotUsed, TierPolicy.dailyLimit(tier, Feature.TAROT)),
                new ProgressResponse.UsageInfo(generateUsed, TierPolicy.dailyLimit(tier, Feature.GENERATE)),
                TierPolicy.maxSets(tier),
                TierPolicy.hasAdjustableSets(tier),
                TierPolicy.tierFloor(tier)
        );
    }
```

를 다음으로 교체:

```java
    public ProgressResponse getProgress(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        Tier tier = TierPolicy.effectiveTier(user.getForcedTier(), user.getTotalPoints());
        LocalDate today = LocalDate.now(KST);
        int tarotUsed = usageCountFor(userId, today, Feature.TAROT);
        int generateUsed = usageCountFor(userId, today, Feature.GENERATE);
        int pensionUsed = usageCountFor(userId, today, Feature.PENSION);
        return new ProgressResponse(
                tier.label(),
                user.getTotalPoints(),
                TierPolicy.pointsToNextTier(tier, user.getTotalPoints()),
                new ProgressResponse.UsageInfo(tarotUsed, TierPolicy.dailyLimit(tier, Feature.TAROT)),
                new ProgressResponse.UsageInfo(generateUsed, TierPolicy.dailyLimit(tier, Feature.GENERATE)),
                new ProgressResponse.UsageInfo(pensionUsed, TierPolicy.dailyLimit(tier, Feature.PENSION)),
                TierPolicy.maxSets(tier),
                TierPolicy.hasAdjustableSets(tier),
                TierPolicy.tierFloor(tier)
        );
    }
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.progress.UsageServiceTest"`
Expected: `BUILD SUCCESSFUL`, 전부 통과

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/progress/ProgressResponse.java backend/src/main/java/com/lottopredictor/backend/progress/UsageService.java backend/src/test/java/com/lottopredictor/backend/progress/UsageServiceTest.java
git commit -m "Include pension usage in the progress response"
```

---

### Task 4: `PensionGenerateController`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/api/PensionGenerateController.java`

**Interfaces:**
- Consumes: Task 1의 `Feature.PENSION`, Task 2의 `PensionNumberGenerationService.generate(): PensionGenerateResult`, 기존 `UsageService.consume(Long, Feature): boolean`
- Produces: 없음 (이 플랜의 마지막 태스크)

이 태스크는 Task 1, 2에 의존한다. 컨트롤러는 이 코드베이스 컨벤션상 전용 테스트가 없다 — 컴파일 확인 + 전체 테스트 스위트로 검증한다.

- [ ] **Step 1: `PensionGenerateController` 작성**

기존 `GenerateController`(`backend/src/main/java/com/lottopredictor/backend/api/GenerateController.java`)와 같은 패턴:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.pensiongenerate.PensionGenerateResult;
import com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationService;
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

    public PensionGenerateController(PensionNumberGenerationService service, UsageService usageService) {
        this.service = service;
        this.usageService = usageService;
    }

    @GetMapping("/api/pension/generate")
    public ResponseEntity<PensionGenerateResult> generate(@AuthPrincipal AuthenticatedUser principal) {
        if (!usageService.consume(principal.userId(), Feature.PENSION)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        return ResponseEntity.ok(service.generate());
    }
}
```

- [ ] **Step 2: 전체 빌드 확인**

Run: `cd backend && ./gradlew test`
Expected: `BUILD SUCCESSFUL`, 전체 테스트 통과 (기존 테스트 + 이 플랜에서 추가한 테스트 전부)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/api/PensionGenerateController.java
git commit -m "Add GET /api/pension/generate endpoint"
```

---

## 배포 참고사항 (이 플랜 밖의 수동 작업)

없음 — `Feature` enum은 문자열 컬럼(`@Enumerated(EnumType.STRING)`)에 저장되므로 DB 마이그레이션이 필요 없다. `git push` 한 번으로 배포된다.

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서의 `Feature.PENSION` 추가(Task 1), 완전 랜덤 생성 서비스(Task 2), `ProgressResponse` 확장(Task 3), 엔드포인트(Task 4) 전부 태스크로 반영됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 없음 — 전 스텝에 실제 코드/명령어 포함.
- **타입 일관성:** `PensionGenerateResult(int groupNo, String number)`(Task 2에서 정의)를 Task 4의 `PensionGenerateController`가 그대로 반환 타입으로 사용. `Feature.PENSION`(Task 1에서 정의)을 Task 3(`UsageService.getProgress()`)과 Task 4(`PensionGenerateController.generate()`)가 동일하게 참조. `ProgressResponse`의 생성자 인자 순서(Task 3에서 `tarotUsage, generateUsage, pensionUsage, maxSets, adjustableSets, tierFloor` 순으로 확정)가 `UsageService.getProgress()`의 실제 호출 순서와 일치함을 확인함.
- **기존 코드 영향 범위 확인:** `ProgressResponse`를 직접 생성하는 곳은 `UsageService.getProgress()` 한 곳뿐임을 grep으로 확인함 — Task 3에서 그 한 곳만 수정하면 다른 파일에서 생성자 인자 개수 불일치로 인한 컴파일 에러가 발생하지 않는다. `GenerateController`/`NumberGenerationService`/`WeightedRandomSampler` 등 기존 로또 번호생성 코드는 이 플랜에서 전혀 수정하지 않는다.
