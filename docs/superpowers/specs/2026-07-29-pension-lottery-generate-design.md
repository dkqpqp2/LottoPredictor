# 연금복권720+ 번호 생성 + 진행도 연동 (2단계) 설계

## 배경 및 목적

1단계에서 연금복권720+ 당첨 이력을 크롤링해 DB에 저장하는 기능을 만들었다. 이번 2단계는 실제로 사용자가 연금복권 번호를 뽑을 수 있는 백엔드 기능 — 번호 생성 로직과, 등급별 일일 횟수 제한(진행도 시스템) 연동 — 을 추가한다. 프론트엔드 화면(뽑기 UI)은 3단계에서 만든다.

## 범위

**포함:**
- 연금복권 번호 완전 랜덤 생성 (조 1~5 + 6자리 번호, 통계 기반 가중치 없음)
- `Feature` enum에 `PENSION` 추가, 등급 무관 하루 1회 고정 제한
- `GET /api/pension/generate` 엔드포인트 (횟수 소진 확인 + 생성)
- `ProgressResponse`에 연금복권 사용 현황(`pensionUsage`) 추가

**제외 (다음 단계로 미룸):**
- 프론트 뽑기 화면 — 3단계
- 저장된 번호 매칭/등수 표시 — 4단계

## 설계 결정

**왜 완전 랜덤만 만드는가:** 로또의 "가중치 기반" 모드는 45개 숫자 풀에서 6개를 중복 없이 뽑는 구조라 과거 출현 빈도를 가중치로 쓰는 게 자연스럽다. 연금복권은 "조 1개 + 6자리 번호 1개"를 뽑는 구조라 그런 풀/중복없음 개념 자체가 없고, 실제 추첨도 완전 무작위다. 자릿수별 과거 빈도를 억지로 가중치로 쓰는 건 의미 있는 통계가 아니라 임의의 숫자놀음에 가깝다고 판단해 완전 랜덤만 구현한다. 이 때문에 `PensionNumberGenerationService`는 `PensionDrawRepository`(1단계에서 만든 크롤링 데이터)에 전혀 의존하지 않는다 — 순수하게 독립적인 난수 생성이다.

**왜 등급 무관 하루 1회 고정인가:** 로또 번호생성/타로 AI 해석은 등급에 따라 하루 횟수가 늘어나지만(뽑기 초심자 1회 → 뽑기의 신 무제한), 연금복권은 등급과 무관하게 모두에게 하루 1회로 고정한다 (사용자 직접 결정 사항).

## 아키텍처

### `Feature` enum 확장

```java
public enum Feature {
    TAROT,
    GENERATE,
    PENSION
}
```

`DailyUsage` 엔티티는 `feature` 컬럼을 `@Enumerated(EnumType.STRING)`으로 저장하므로(이미 문자열 컬럼), enum에 값을 추가하는 것만으로 DB 마이그레이션 없이 바로 동작한다.

### `TierPolicy.dailyLimit()` 확장

기존 `DailyLimits` 레코드(등급별 tarot/generate 횟수 테이블)를 건드리지 않고, `PENSION`은 등급을 조회하기 전에 특수 케이스로 처리한다:

```java
public static int dailyLimit(Tier tier, Feature feature) {
    if (feature == Feature.PENSION) {
        return 1;
    }
    DailyLimits limits = DAILY_LIMITS.get(tier);
    return feature == Feature.TAROT ? limits.tarot() : limits.generate();
}
```

### `PensionNumberGenerationService` (신규, 새 패키지 `com.lottopredictor.backend.pensiongenerate`)

```java
public record PensionGenerateResult(int groupNo, String number) {
}
```

```java
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

기존 `NumberGenerationService`가 테스트 결정론을 위해 패키지 전용 `DoubleSupplier rng` 오버로드를 두는 것과 같은 패턴이다. 리포지토리 의존성이 없다 — "설계 결정" 섹션 참고.

### `PensionGenerateController` (신규)

```
GET /api/pension/generate
```

기존 `GenerateController`와 동일한 패턴: 로그인 필요(`@AuthPrincipal`), `usageService.consume(userId, Feature.PENSION)`으로 횟수 확인 후 초과 시 429, 성공 시 `PensionGenerateResult` 반환. "세트 수" 개념이 없으므로(항상 1개) 쿼리 파라미터가 없다.

### `ProgressResponse` 확장

```java
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

`UsageService.getProgress()`가 `pensionUsed`를 계산해서(기존 `usageCountFor` 헬퍼 재사용) `pensionUsage` 필드를 채운다. 이 레코드를 직접 생성하는 곳은 `UsageService.getProgress()` 한 곳뿐이라(테스트 포함 확인함) 다른 파일에서 생성자 인자 개수 변경으로 인한 컴파일 에러는 없다.

## 데이터 흐름

```
GET /api/pension/generate (로그인 필요)
  → usageService.consume(userId, Feature.PENSION)
      → 오늘 사용 횟수가 1 미만이면 카운트 증가 + 포인트 적립, true 반환
      → 이미 1회 사용했으면 false 반환 → 컨트롤러가 429 응답
  → true면 pensionNumberGenerationService.generate() → { groupNo, number } 반환

GET /api/progress/me (기존 엔드포인트, 변경 없음 — 응답 형태만 확장)
  → usageService.getProgress(userId)
      → tarotUsage, generateUsage, pensionUsage 전부 포함해서 반환
```

## 에러 처리

- 로그인 안 됨: 기존 `@AuthPrincipal` 인증 실패 처리 그대로(401), 이 태스크에서 추가 처리 없음
- 오늘 이미 1회 사용: 429 (기존 `/api/generate`와 동일한 응답 코드/패턴)
- 그 외 실패 시나리오 없음 — 순수 메모리 연산(난수 생성)이라 외부 호출/DB 조회 실패 지점이 없다

## 테스트

- `PensionNumberGenerationServiceTest`: 조가 1~5 범위인지, 번호가 6자리 0패딩 문자열인지(여러 번 반복 실행으로 확인), 고정 `rng`(`() -> 0.0`, `() -> 0.999999`)로 호출했을 때 정확한 경계값(조 1/번호 "000000", 조 5/번호 "999999")이 나오는지 검증
- `TierPolicyTest`에 `PENSION`이 모든 등급에서 1인지 확인하는 테스트 추가 (기존 "타로는 등급 무관 1회" 테스트와 동일한 패턴)
- `UsageServiceTest`의 `getProgressReportsTierPointsAndTodayUsage`를 갱신해서 `progress.pensionUsage()`도 확인
- 컨트롤러는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 (기존 `GenerateController`도 동일) — 컴파일 확인 + 전체 테스트 스위트로 검증

## 영향받는 파일

- `backend/src/main/java/com/lottopredictor/backend/progress/Feature.java` — `PENSION` 추가
- `backend/src/main/java/com/lottopredictor/backend/progress/TierPolicy.java` — `dailyLimit()`에 `PENSION` 특수 케이스 추가
- `backend/src/test/java/com/lottopredictor/backend/progress/TierPolicyTest.java` — 테스트 추가
- `backend/src/main/java/com/lottopredictor/backend/progress/ProgressResponse.java` — `pensionUsage` 필드 추가
- `backend/src/main/java/com/lottopredictor/backend/progress/UsageService.java` — `getProgress()`에서 `pensionUsage` 계산/포함
- `backend/src/test/java/com/lottopredictor/backend/progress/UsageServiceTest.java` — 기존 테스트 갱신
- `backend/src/main/java/com/lottopredictor/backend/pensiongenerate/PensionGenerateResult.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensiongenerate/PensionNumberGenerationService.java` — 신규
- `backend/src/test/java/com/lottopredictor/backend/pensiongenerate/PensionNumberGenerationServiceTest.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/api/PensionGenerateController.java` — 신규

## 배포 참고사항

DB 마이그레이션 없음 (`Feature` enum은 문자열 컬럼에 저장되므로 스키마 변경 불필요). 순수 백엔드 코드 변경이라 일반적인 배포 절차(`git push`)만으로 충분하다.
