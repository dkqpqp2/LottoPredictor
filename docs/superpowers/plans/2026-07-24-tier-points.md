# 등급제/포인트 시스템 (1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포인트 적립·자동 승급·등급별 일일 사용량 제한을 구현하고, 타로/번호생성을 로그인 필수 기능으로 전환한다.

**Architecture:** 백엔드에 새 `progress` 패키지(포인트/등급/일일 사용량 로직)를 추가하고, 기존 `/api/generate`에 인증+사용량 게이트를 건다. 타로는 순수 프론트 계산이라 뽑기 직전에 `/api/progress/tarot-usage`를 호출해 서버 게이트를 통과해야만 진행되게 만든다. 프론트는 `AuthContext`와 같은 패턴의 `ProgressContext`를 추가해 등급/포인트/오늘 사용량을 전역으로 들고 있는다.

**Tech Stack:** Spring Boot 4.1.0 (Java 21, Spring Data JPA), Next.js 16 App Router (TypeScript, CSS Modules), Vitest.

## Global Constraints

- 등급: 초심자(0~49P) / 견습생(50~149P) / 고수(150~349P) / 마스터(350P~) / 뽑기의 신(이번 단계에서 도달 불가, enum에만 존재)
- 등급별 일일 한도(타로/번호생성 각각 별도 카운트): 초심자 1/1, 견습생 2/2, 고수 3/3, 마스터 5/5, 뽑기의 신 무제한
- 번호생성은 가중치/랜덤 모드 통틀어 `/api/generate` 호출 1회 = 사용 1회 (세트 개수와 무관)
- 포인트: 타로 1회 +1P, 번호생성 1회 +1P, 하루 첫 방문(로그인 상태, 페이지 종류 무관) +2P, 7일 연속 출석마다(7일, 14일, 21일 ...) 반복 보너스 +10P. 하루라도 방문을 거르면 연속일수는 1로 리셋
- 등급은 별도 컬럼에 저장하지 않고 누적 포인트로부터 항상 계산한다
- `GET /api/progress/me`는 조회와 동시에 "오늘 첫 방문" 출석 처리를 겸한다 (일반적인 REST GET 무부작용 원칙에서 벗어나지만, 프론트가 앱 로드 시 자연스럽게 한 번 호출하는 지점이라 의도적으로 이렇게 설계함 — 별도 체크인 엔드포인트를 만들지 않기로 한 결정)
- 타로/번호생성은 로그인 필수. 통계(`/stats`)/회차조회(`/draws`)는 계속 비로그인 자유 열람
- 동시 요청으로 한도를 살짝 넘기는 경쟁 상태는 이번 단계에서 감수한다 (낙관적 처리)
- 프론트 lib 파일은 상대경로 import 사용, React 컴포넌트는 자동 테스트 없이 타입체크 + 브라우저 수동 확인 (기존 컨벤션)

---

### Task 1: DB 마이그레이션 + `User` 엔티티에 포인트/출석 필드 추가

**Files:**
- Create: `db/migrations/0004_add_progress_to_users.sql`
- Create: `db/migrations/0005_create_daily_usage.sql`
- Modify: `backend/src/main/java/com/lottopredictor/backend/auth/User.java`

**Interfaces:**
- Produces: `User`에 `getTotalPoints(): int`, `getCurrentStreak(): int`, `getLastActiveDate(): LocalDate`, `addPoints(int amount): void`, `setCurrentStreak(int streak): void`, `setLastActiveDate(LocalDate date): void` 추가

리포지토리/엔티티는 이 코드베이스 컨벤션상 직접 테스트하지 않는다 (기존 `User`/`UserRepository`도 전용 테스트 없음). 이 태스크는 컴파일 확인으로 충분하다.

- [ ] **Step 1: `0004_add_progress_to_users.sql` 작성**

```sql
alter table users
  add column total_points integer not null default 0,
  add column current_streak integer not null default 0,
  add column last_active_date date;
```

- [ ] **Step 2: `0005_create_daily_usage.sql` 작성**

```sql
create table if not exists daily_usage (
  id bigserial primary key,
  user_id bigint not null references users(id),
  usage_date date not null,
  feature varchar(20) not null,
  count integer not null default 0,
  unique (user_id, usage_date, feature)
);
```

- [ ] **Step 3: `User.java`에 필드/메서드 추가**

현재 `backend/src/main/java/com/lottopredictor/backend/auth/User.java` 전체:

```java
package com.lottopredictor.backend.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kakao_id", nullable = false, unique = true)
    private Long kakaoId;

    @Column(name = "nickname", nullable = false)
    private String nickname;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected User() {
    }

    public User(Long kakaoId, String nickname) {
        this.kakaoId = kakaoId;
        this.nickname = nickname;
    }

    public Long getId() {
        return id;
    }

    public Long getKakaoId() {
        return kakaoId;
    }

    public String getNickname() {
        return nickname;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void updateNickname(String nickname) {
        this.nickname = nickname;
    }
}
```

다음으로 교체 (import 추가, 필드 3개 추가, getter/mutator 6개 추가):

```java
package com.lottopredictor.backend.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kakao_id", nullable = false, unique = true)
    private Long kakaoId;

    @Column(name = "nickname", nullable = false)
    private String nickname;

    @Column(name = "total_points", nullable = false)
    private int totalPoints;

    @Column(name = "current_streak", nullable = false)
    private int currentStreak;

    @Column(name = "last_active_date")
    private LocalDate lastActiveDate;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected User() {
    }

    public User(Long kakaoId, String nickname) {
        this.kakaoId = kakaoId;
        this.nickname = nickname;
    }

    public Long getId() {
        return id;
    }

    public Long getKakaoId() {
        return kakaoId;
    }

    public String getNickname() {
        return nickname;
    }

    public int getTotalPoints() {
        return totalPoints;
    }

    public int getCurrentStreak() {
        return currentStreak;
    }

    public LocalDate getLastActiveDate() {
        return lastActiveDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void updateNickname(String nickname) {
        this.nickname = nickname;
    }

    public void addPoints(int amount) {
        this.totalPoints += amount;
    }

    public void setCurrentStreak(int streak) {
        this.currentStreak = streak;
    }

    public void setLastActiveDate(LocalDate date) {
        this.lastActiveDate = date;
    }
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0004_add_progress_to_users.sql db/migrations/0005_create_daily_usage.sql backend/src/main/java/com/lottopredictor/backend/auth/User.java
git commit -m "Add points/streak fields to User and daily_usage table"
```

---

### Task 2: `Feature` / `Tier` / `TierPolicy` (순수 로직)

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/progress/Feature.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/progress/Tier.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/progress/TierPolicy.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/progress/TierPolicyTest.java`

**Interfaces:**
- Produces: `enum Feature { TAROT, GENERATE }`. `enum Tier { BEGINNER, APPRENTICE, EXPERT, MASTER, LOTTO_GOD }`에 `label(): String`. `TierPolicy.tierForPoints(int totalPoints): Tier`, `TierPolicy.dailyLimit(Tier tier, Feature feature): int`, `TierPolicy.pointsToNextTier(int totalPoints): Integer`(마스터/뽑기의 신이면 null)

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.lottopredictor.backend.progress;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TierPolicyTest {

    @Test
    void mapsZeroPointsToBeginner() {
        assertThat(TierPolicy.tierForPoints(0)).isEqualTo(Tier.BEGINNER);
        assertThat(TierPolicy.tierForPoints(49)).isEqualTo(Tier.BEGINNER);
    }

    @Test
    void mapsFiftyPointsToApprentice() {
        assertThat(TierPolicy.tierForPoints(50)).isEqualTo(Tier.APPRENTICE);
        assertThat(TierPolicy.tierForPoints(149)).isEqualTo(Tier.APPRENTICE);
    }

    @Test
    void mapsOneHundredFiftyPointsToExpert() {
        assertThat(TierPolicy.tierForPoints(150)).isEqualTo(Tier.EXPERT);
        assertThat(TierPolicy.tierForPoints(349)).isEqualTo(Tier.EXPERT);
    }

    @Test
    void mapsThreeHundredFiftyPointsToMaster() {
        assertThat(TierPolicy.tierForPoints(350)).isEqualTo(Tier.MASTER);
        assertThat(TierPolicy.tierForPoints(10_000)).isEqualTo(Tier.MASTER);
    }

    @Test
    void neverReturnsLottoGodFromPoints() {
        for (int points = 0; points <= 5000; points += 37) {
            assertThat(TierPolicy.tierForPoints(points)).isNotEqualTo(Tier.LOTTO_GOD);
        }
    }

    @Test
    void beginnerHasOneUsePerFeaturePerDay() {
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.TAROT)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.GENERATE)).isEqualTo(1);
    }

    @Test
    void masterHasFiveUsesPerFeaturePerDay() {
        assertThat(TierPolicy.dailyLimit(Tier.MASTER, Feature.TAROT)).isEqualTo(5);
        assertThat(TierPolicy.dailyLimit(Tier.MASTER, Feature.GENERATE)).isEqualTo(5);
    }

    @Test
    void lottoGodHasEffectivelyUnlimitedUses() {
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.TAROT)).isEqualTo(Integer.MAX_VALUE);
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.GENERATE)).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void computesPointsNeededForNextTier() {
        assertThat(TierPolicy.pointsToNextTier(0)).isEqualTo(50);
        assertThat(TierPolicy.pointsToNextTier(40)).isEqualTo(10);
        assertThat(TierPolicy.pointsToNextTier(150)).isEqualTo(200);
    }

    @Test
    void returnsNullForPointsToNextTierAtMaster() {
        assertThat(TierPolicy.pointsToNextTier(350)).isNull();
        assertThat(TierPolicy.pointsToNextTier(9999)).isNull();
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.progress.TierPolicyTest"`
Expected: FAIL (컴파일 에러 — `Feature`, `Tier`, `TierPolicy`가 아직 없음)

- [ ] **Step 3: `Feature` 작성**

```java
package com.lottopredictor.backend.progress;

public enum Feature {
    TAROT,
    GENERATE
}
```

- [ ] **Step 4: `Tier` 작성**

```java
package com.lottopredictor.backend.progress;

public enum Tier {
    BEGINNER("초심자"),
    APPRENTICE("견습생"),
    EXPERT("고수"),
    MASTER("마스터"),
    LOTTO_GOD("뽑기의 신");

    private final String label;

    Tier(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
```

- [ ] **Step 5: `TierPolicy` 작성**

```java
package com.lottopredictor.backend.progress;

import java.util.Map;

public final class TierPolicy {

    private TierPolicy() {
    }

    private record DailyLimits(int tarot, int generate) {
    }

    private static final Map<Tier, DailyLimits> DAILY_LIMITS = Map.of(
            Tier.BEGINNER, new DailyLimits(1, 1),
            Tier.APPRENTICE, new DailyLimits(2, 2),
            Tier.EXPERT, new DailyLimits(3, 3),
            Tier.MASTER, new DailyLimits(5, 5),
            Tier.LOTTO_GOD, new DailyLimits(Integer.MAX_VALUE, Integer.MAX_VALUE)
    );

    public static Tier tierForPoints(int totalPoints) {
        if (totalPoints >= 350) return Tier.MASTER;
        if (totalPoints >= 150) return Tier.EXPERT;
        if (totalPoints >= 50) return Tier.APPRENTICE;
        return Tier.BEGINNER;
    }

    public static int dailyLimit(Tier tier, Feature feature) {
        DailyLimits limits = DAILY_LIMITS.get(tier);
        return feature == Feature.TAROT ? limits.tarot() : limits.generate();
    }

    public static Integer pointsToNextTier(int totalPoints) {
        Tier tier = tierForPoints(totalPoints);
        return switch (tier) {
            case BEGINNER -> 50 - totalPoints;
            case APPRENTICE -> 150 - totalPoints;
            case EXPERT -> 350 - totalPoints;
            case MASTER, LOTTO_GOD -> null;
        };
    }
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.progress.TierPolicyTest"`
Expected: `BUILD SUCCESSFUL`, 10 tests passed

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/progress/Feature.java backend/src/main/java/com/lottopredictor/backend/progress/Tier.java backend/src/main/java/com/lottopredictor/backend/progress/TierPolicy.java backend/src/test/java/com/lottopredictor/backend/progress/TierPolicyTest.java
git commit -m "Add Tier/Feature enums and TierPolicy rules"
```

---

### Task 3: `DailyUsage` + `UsageService`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/progress/DailyUsage.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/progress/DailyUsageRepository.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/progress/UsageService.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/progress/ProgressResponse.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/progress/UsageServiceTest.java`

**Interfaces:**
- Consumes: `User`(Task 1의 `getTotalPoints`/`addPoints`/`getCurrentStreak`/`setCurrentStreak`/`getLastActiveDate`/`setLastActiveDate`), `UserRepository`(기존), `TierPolicy`/`Tier`/`Feature`(Task 2)
- Produces: `record ProgressResponse(String tier, int totalPoints, Integer pointsToNextTier, UsageInfo tarotUsage, UsageInfo generateUsage)`(내부 `record UsageInfo(int used, int limit)`). `UsageService.recordVisit(Long userId): void`, `UsageService.consume(Long userId, Feature feature): boolean`(성공 시 true), `UsageService.getProgress(Long userId): ProgressResponse`

- [ ] **Step 1: `DailyUsage` 작성**

```java
package com.lottopredictor.backend.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "daily_usage")
public class DailyUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "usage_date", nullable = false)
    private LocalDate usageDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature", nullable = false)
    private Feature feature;

    @Column(name = "count", nullable = false)
    private int count;

    protected DailyUsage() {
    }

    public DailyUsage(Long userId, LocalDate usageDate, Feature feature, int count) {
        this.userId = userId;
        this.usageDate = usageDate;
        this.feature = feature;
        this.count = count;
    }

    public Long getId() {
        return id;
    }

    public int getCount() {
        return count;
    }

    public void increment() {
        this.count += 1;
    }
}
```

- [ ] **Step 2: `DailyUsageRepository` 작성**

```java
package com.lottopredictor.backend.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DailyUsageRepository extends JpaRepository<DailyUsage, Long> {

    Optional<DailyUsage> findByUserIdAndUsageDateAndFeature(Long userId, LocalDate usageDate, Feature feature);
}
```

- [ ] **Step 3: `ProgressResponse` 작성**

```java
package com.lottopredictor.backend.progress;

public record ProgressResponse(
        String tier,
        int totalPoints,
        Integer pointsToNextTier,
        UsageInfo tarotUsage,
        UsageInfo generateUsage
) {
    public record UsageInfo(int used, int limit) {
    }
}
```

- [ ] **Step 4: 실패하는 테스트 작성**

```java
package com.lottopredictor.backend.progress;

import com.lottopredictor.backend.auth.User;
import com.lottopredictor.backend.auth.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DailyUsageRepository dailyUsageRepository;

    private User newUser() {
        return new User(123L, "홍길동");
    }

    @Test
    void consumeSucceedsAndAwardsAPointWhenUnderTheDailyLimit() {
        User user = newUser();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(dailyUsageRepository.findByUserIdAndUsageDateAndFeature(eq(1L), any(LocalDate.class), eq(Feature.TAROT)))
                .thenReturn(Optional.empty());

        UsageService service = new UsageService(userRepository, dailyUsageRepository);
        boolean result = service.consume(1L, Feature.TAROT);

        assertThat(result).isTrue();
        assertThat(user.getTotalPoints()).isEqualTo(1);
        verify(dailyUsageRepository).save(any(DailyUsage.class));
        verify(userRepository).save(user);
    }

    @Test
    void consumeFailsAndLeavesStateUnchangedWhenAtTheDailyLimit() {
        User user = newUser();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        DailyUsage existing = new DailyUsage(1L, LocalDate.now(), Feature.TAROT, 1);
        when(dailyUsageRepository.findByUserIdAndUsageDateAndFeature(eq(1L), any(LocalDate.class), eq(Feature.TAROT)))
                .thenReturn(Optional.of(existing));

        UsageService service = new UsageService(userRepository, dailyUsageRepository);
        boolean result = service.consume(1L, Feature.TAROT);

        assertThat(result).isFalse();
        assertThat(user.getTotalPoints()).isEqualTo(0);
        assertThat(existing.getCount()).isEqualTo(1);
    }

    @Test
    void recordVisitAwardsAttendancePointsOnlyOncePerDay() {
        User user = newUser();
        user.setLastActiveDate(LocalDate.now());
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UsageService service = new UsageService(userRepository, dailyUsageRepository);
        service.recordVisit(1L);

        assertThat(user.getTotalPoints()).isEqualTo(0);
    }

    @Test
    void recordVisitAwardsAttendancePointsAndBumpsStreakOnConsecutiveDay() {
        User user = newUser();
        user.setLastActiveDate(LocalDate.now().minusDays(1));
        user.setCurrentStreak(3);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UsageService service = new UsageService(userRepository, dailyUsageRepository);
        service.recordVisit(1L);

        assertThat(user.getTotalPoints()).isEqualTo(2);
        assertThat(user.getCurrentStreak()).isEqualTo(4);
        assertThat(user.getLastActiveDate()).isEqualTo(LocalDate.now());
    }

    @Test
    void recordVisitResetsStreakWhenADayWasMissed() {
        User user = newUser();
        user.setLastActiveDate(LocalDate.now().minusDays(3));
        user.setCurrentStreak(5);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UsageService service = new UsageService(userRepository, dailyUsageRepository);
        service.recordVisit(1L);

        assertThat(user.getCurrentStreak()).isEqualTo(1);
    }

    @Test
    void recordVisitAwardsStreakBonusOnTheSeventhConsecutiveDay() {
        User user = newUser();
        user.setLastActiveDate(LocalDate.now().minusDays(1));
        user.setCurrentStreak(6);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UsageService service = new UsageService(userRepository, dailyUsageRepository);
        service.recordVisit(1L);

        assertThat(user.getCurrentStreak()).isEqualTo(7);
        assertThat(user.getTotalPoints()).isEqualTo(12);
    }

    @Test
    void getProgressReportsTierPointsAndTodayUsage() {
        User user = newUser();
        user.addPoints(50);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(dailyUsageRepository.findByUserIdAndUsageDateAndFeature(eq(1L), any(LocalDate.class), eq(Feature.TAROT)))
                .thenReturn(Optional.of(new DailyUsage(1L, LocalDate.now(), Feature.TAROT, 1)));
        when(dailyUsageRepository.findByUserIdAndUsageDateAndFeature(eq(1L), any(LocalDate.class), eq(Feature.GENERATE)))
                .thenReturn(Optional.empty());

        UsageService service = new UsageService(userRepository, dailyUsageRepository);
        ProgressResponse progress = service.getProgress(1L);

        assertThat(progress.tier()).isEqualTo("견습생");
        assertThat(progress.totalPoints()).isEqualTo(50);
        assertThat(progress.pointsToNextTier()).isEqualTo(100);
        assertThat(progress.tarotUsage()).isEqualTo(new ProgressResponse.UsageInfo(1, 2));
        assertThat(progress.generateUsage()).isEqualTo(new ProgressResponse.UsageInfo(0, 2));
    }
}
```

- [ ] **Step 5: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.progress.UsageServiceTest"`
Expected: FAIL (컴파일 에러 — `UsageService`가 아직 없음)

- [ ] **Step 6: `UsageService` 작성**

```java
package com.lottopredictor.backend.progress;

import com.lottopredictor.backend.auth.User;
import com.lottopredictor.backend.auth.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class UsageService {

    private static final int USAGE_POINTS = 1;
    private static final int VISIT_POINTS = 2;
    private static final int STREAK_BONUS_POINTS = 10;
    private static final int STREAK_BONUS_DAYS = 7;

    private final UserRepository userRepository;
    private final DailyUsageRepository dailyUsageRepository;

    public UsageService(UserRepository userRepository, DailyUsageRepository dailyUsageRepository) {
        this.userRepository = userRepository;
        this.dailyUsageRepository = dailyUsageRepository;
    }

    public void recordVisit(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        LocalDate today = LocalDate.now();
        if (today.equals(user.getLastActiveDate())) {
            return;
        }

        boolean consecutive = user.getLastActiveDate() != null
                && user.getLastActiveDate().equals(today.minusDays(1));
        int newStreak = consecutive ? user.getCurrentStreak() + 1 : 1;
        user.setCurrentStreak(newStreak);
        user.setLastActiveDate(today);
        user.addPoints(VISIT_POINTS);
        if (newStreak % STREAK_BONUS_DAYS == 0) {
            user.addPoints(STREAK_BONUS_POINTS);
        }
        userRepository.save(user);
    }

    public boolean consume(Long userId, Feature feature) {
        User user = userRepository.findById(userId).orElseThrow();
        Tier tier = TierPolicy.tierForPoints(user.getTotalPoints());
        int limit = TierPolicy.dailyLimit(tier, feature);

        LocalDate today = LocalDate.now();
        DailyUsage usage = dailyUsageRepository
                .findByUserIdAndUsageDateAndFeature(userId, today, feature)
                .orElseGet(() -> new DailyUsage(userId, today, feature, 0));

        if (usage.getCount() >= limit) {
            return false;
        }

        usage.increment();
        dailyUsageRepository.save(usage);
        user.addPoints(USAGE_POINTS);
        userRepository.save(user);
        return true;
    }

    public ProgressResponse getProgress(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        Tier tier = TierPolicy.tierForPoints(user.getTotalPoints());
        LocalDate today = LocalDate.now();
        int tarotUsed = usageCountFor(userId, today, Feature.TAROT);
        int generateUsed = usageCountFor(userId, today, Feature.GENERATE);
        return new ProgressResponse(
                tier.label(),
                user.getTotalPoints(),
                TierPolicy.pointsToNextTier(user.getTotalPoints()),
                new ProgressResponse.UsageInfo(tarotUsed, TierPolicy.dailyLimit(tier, Feature.TAROT)),
                new ProgressResponse.UsageInfo(generateUsed, TierPolicy.dailyLimit(tier, Feature.GENERATE))
        );
    }

    private int usageCountFor(Long userId, LocalDate date, Feature feature) {
        return dailyUsageRepository.findByUserIdAndUsageDateAndFeature(userId, date, feature)
                .map(DailyUsage::getCount)
                .orElse(0);
    }
}
```

- [ ] **Step 7: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.progress.UsageServiceTest"`
Expected: `BUILD SUCCESSFUL`, 7 tests passed

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/progress/DailyUsage.java backend/src/main/java/com/lottopredictor/backend/progress/DailyUsageRepository.java backend/src/main/java/com/lottopredictor/backend/progress/ProgressResponse.java backend/src/main/java/com/lottopredictor/backend/progress/UsageService.java backend/src/test/java/com/lottopredictor/backend/progress/UsageServiceTest.java
git commit -m "Add DailyUsage tracking and UsageService"
```

---

### Task 4: `ProgressController` (`/api/progress/me`, `/api/progress/tarot-usage`)

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/api/ProgressController.java`

**Interfaces:**
- Consumes: `UsageService`(Task 3), `@AuthPrincipal`/`AuthenticatedUser`(기존, 카카오 로그인 스펙에서 만들어짐)
- Produces: `GET /api/progress/me` → `ProgressResponse`(출석 처리 겸함), `POST /api/progress/tarot-usage` → 성공 시 200 + `ProgressResponse`, 한도 초과 시 429

이 코드베이스는 컨트롤러를 직접 테스트하지 않는 컨벤션이다. 전체 빌드 통과로 검증한다.

- [ ] **Step 1: `ProgressController` 작성**

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.ProgressResponse;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProgressController {

    private final UsageService usageService;

    public ProgressController(UsageService usageService) {
        this.usageService = usageService;
    }

    @GetMapping("/api/progress/me")
    public ProgressResponse me(@AuthPrincipal AuthenticatedUser principal) {
        usageService.recordVisit(principal.userId());
        return usageService.getProgress(principal.userId());
    }

    @PostMapping("/api/progress/tarot-usage")
    public ResponseEntity<ProgressResponse> tarotUsage(@AuthPrincipal AuthenticatedUser principal) {
        if (!usageService.consume(principal.userId(), Feature.TAROT)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        return ResponseEntity.ok(usageService.getProgress(principal.userId()));
    }
}
```

- [ ] **Step 2: 전체 빌드 확인**

Run: `cd backend && ./gradlew build`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/api/ProgressController.java
git commit -m "Add progress endpoints (me, tarot-usage)"
```

---

### Task 5: `/api/generate`에 로그인 + 사용량 게이트 적용

**Files:**
- Modify: `backend/src/main/java/com/lottopredictor/backend/api/GenerateController.java`

**Interfaces:**
- Consumes: `UsageService`(Task 3), `@AuthPrincipal`/`AuthenticatedUser`(기존)

이 컨트롤러의 동작이 바뀐다: 기존엔 비로그인도 호출 가능했지만, 이제 로그인 필수 + 등급별 일일 한도 적용. 기존 `NumberGenerationServiceTest` 등은 이 컨트롤러를 거치지 않고 서비스 레이어를 직접 테스트하므로 영향받지 않는다.

- [ ] **Step 1: `GenerateController.java` 전체를 다음으로 교체**

현재 파일:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.generate.GenerateResult;
import com.lottopredictor.backend.generate.NumberGenerationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GenerateController {

    private final NumberGenerationService service;

    public GenerateController(NumberGenerationService service) {
        this.service = service;
    }

    @GetMapping("/api/generate")
    public GenerateResult generate(
            @RequestParam(defaultValue = "weighted") String mode,
            @RequestParam(defaultValue = "1") int sets
    ) {
        int clampedSets = Math.min(Math.max(sets, 1), 10);
        String normalizedMode = "random".equals(mode) ? "random" : "weighted";
        return service.generate(normalizedMode, clampedSets);
    }
}
```

다음으로 교체:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.generate.GenerateResult;
import com.lottopredictor.backend.generate.NumberGenerationService;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GenerateController {

    private final NumberGenerationService service;
    private final UsageService usageService;

    public GenerateController(NumberGenerationService service, UsageService usageService) {
        this.service = service;
        this.usageService = usageService;
    }

    @GetMapping("/api/generate")
    public ResponseEntity<GenerateResult> generate(
            @RequestParam(defaultValue = "weighted") String mode,
            @RequestParam(defaultValue = "1") int sets,
            @AuthPrincipal AuthenticatedUser principal
    ) {
        if (!usageService.consume(principal.userId(), Feature.GENERATE)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        int clampedSets = Math.min(Math.max(sets, 1), 10);
        String normalizedMode = "random".equals(mode) ? "random" : "weighted";
        return ResponseEntity.ok(service.generate(normalizedMode, clampedSets));
    }
}
```

- [ ] **Step 2: 전체 빌드 확인**

Run: `cd backend && ./gradlew build`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/api/GenerateController.java
git commit -m "Require login and enforce daily quota on /api/generate"
```

---

### Task 6: 프론트 `lib/progress.ts`

**Files:**
- Create: `frontend/lib/progress.ts`
- Test: `frontend/lib/progress.test.ts`

**Interfaces:**
- Produces: `interface ProgressResult { tier: string; totalPoints: number; pointsToNextTier: number | null; tarotUsage: {used: number; limit: number}; generateUsage: {used: number; limit: number} }`. `getProgress(token: string): Promise<ProgressResult>`. `consumeTarotUsage(token: string): Promise<ProgressResult>`(429면 한도 초과 메시지로 reject)

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { getProgress, consumeTarotUsage } from "./progress";

describe("getProgress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the progress payload on success", async () => {
    const payload = {
      tier: "초심자",
      totalPoints: 3,
      pointsToNextTier: 47,
      tarotUsage: { used: 0, limit: 1 },
      generateUsage: { used: 0, limit: 1 },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getProgress("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getProgress("jwt-abc")).rejects.toThrow("등급 정보를 불러오지 못했습니다.");
  });
});

describe("consumeTarotUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the updated progress on success", async () => {
    const payload = {
      tier: "초심자",
      totalPoints: 4,
      pointsToNextTier: 46,
      tarotUsage: { used: 1, limit: 1 },
      generateUsage: { used: 0, limit: 1 },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await consumeTarotUsage("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(consumeTarotUsage("jwt-abc")).rejects.toThrow(
      "오늘 타로 사용 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요."
    );
  });

  it("throws a generic message on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(consumeTarotUsage("jwt-abc")).rejects.toThrow("타로 사용 처리에 실패했습니다.");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/progress.test.ts`
Expected: FAIL (`./progress` 모듈이 아직 없음)

- [ ] **Step 3: `lib/progress.ts` 작성**

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export interface ProgressResult {
  tier: string;
  totalPoints: number;
  pointsToNextTier: number | null;
  tarotUsage: { used: number; limit: number };
  generateUsage: { used: number; limit: number };
}

export async function getProgress(token: string): Promise<ProgressResult> {
  const res = await fetch(`${API_BASE_URL}/api/progress/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("등급 정보를 불러오지 못했습니다.");
  }
  return res.json();
}

export async function consumeTarotUsage(token: string): Promise<ProgressResult> {
  const res = await fetch(`${API_BASE_URL}/api/progress/tarot-usage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    throw new Error("오늘 타로 사용 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("타로 사용 처리에 실패했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/progress.test.ts`
Expected: 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/progress.ts frontend/lib/progress.test.ts
git commit -m "Add progress API client functions"
```

---

### Task 7: `lib/api.ts`의 `generateNumbers`에 인증 토큰 + 429 처리 추가

**Files:**
- Modify: `frontend/lib/api.ts:1-16`
- Create: `frontend/lib/api.test.ts`

**Interfaces:**
- Produces: `generateNumbers(mode: GenerateMode, sets: number, token: string): Promise<GenerateResult>` (기존엔 `token` 파라미터가 없었음 — 시그니처 변경)

`api.ts`의 다른 함수들(getStats, getDraws 등)은 이번 태스크 범위 밖이라 건드리지 않는다. 새로 만드는 `api.test.ts`는 `generateNumbers`만 테스트한다 (이 파일에 있는 다른 함수들은 기존에도 테스트가 없었고, 이번 변경 범위도 아니다).

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/api.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateNumbers } from "./api";

describe("generateNumbers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the auth token as a Bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: "weighted", results: [[1, 2, 3, 4, 5, 6]] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await generateNumbers("weighted", 1, "jwt-abc");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer jwt-abc");
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(generateNumbers("weighted", 1, "jwt-abc")).rejects.toThrow(
      "오늘 번호생성 사용 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요."
    );
  });

  it("throws the generic error message on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(generateNumbers("weighted", 1, "jwt-abc")).rejects.toThrow("번호 생성에 실패했습니다.");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/api.test.ts`
Expected: FAIL (`generateNumbers`가 아직 2개 인자만 받음 / 헤더를 안 보냄)

- [ ] **Step 3: `frontend/lib/api.ts`의 `generateNumbers` 함수 교체**

현재:

```typescript
export async function generateNumbers(mode: GenerateMode, sets: number): Promise<GenerateResult> {
  const res = await fetch(`${API_BASE_URL}/api/generate?mode=${mode}&sets=${sets}`);
  if (!res.ok) {
    throw new Error("번호 생성에 실패했습니다.");
  }
  return res.json();
}
```

다음으로 교체:

```typescript
export async function generateNumbers(mode: GenerateMode, sets: number, token: string): Promise<GenerateResult> {
  const res = await fetch(`${API_BASE_URL}/api/generate?mode=${mode}&sets=${sets}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    throw new Error("오늘 번호생성 사용 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("번호 생성에 실패했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/api.test.ts`
Expected: 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/lib/api.test.ts
git commit -m "Send auth token and handle quota-exceeded in generateNumbers"
```

---

### Task 8: `ProgressContext` + 레이아웃 연결

**Files:**
- Create: `frontend/app/contexts/ProgressContext.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: `getProgress`(Task 6), `useAuth`(기존 `AuthContext`)
- Produces: `ProgressProvider({children}): JSX.Element`, `useProgress(): {progress: ProgressResult | null; refreshProgress(): void}`

React 컴포넌트라 자동 테스트는 작성하지 않는다. 타입체크 + 브라우저 수동 확인으로 검증.

- [ ] **Step 1: `ProgressContext.tsx` 작성**

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { getProgress, type ProgressResult } from "../../lib/progress";

interface ProgressContextValue {
  progress: ProgressResult | null;
  refreshProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const [progress, setProgress] = useState<ProgressResult | null>(null);

  function refreshProgress() {
    if (!auth) {
      setProgress(null);
      return;
    }
    getProgress(auth.token)
      .then(setProgress)
      .catch(() => setProgress(null));
  }

  useEffect(() => {
    refreshProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  return <ProgressContext.Provider value={{ progress, refreshProgress }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: `layout.tsx`에서 `ProgressProvider`로 감싸기**

`frontend/app/layout.tsx`의 import 목록에 추가:

```tsx
import { ProgressProvider } from "./contexts/ProgressContext";
```

`RootLayout`의 return 문(현재 `AuthProvider`로 `Nav`+`children`을 감싼 형태)을 다음으로 교체:

```tsx
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          <ProgressProvider>
            <Nav />
            {children}
          </ProgressProvider>
        </AuthProvider>
      </body>
    </html>
  );
```

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add frontend/app/contexts/ProgressContext.tsx frontend/app/layout.tsx
git commit -m "Add ProgressContext and wire it into the root layout"
```

---

### Task 9: `/tarot` 페이지 로그인 게이트 + 사용량 소진 연동

**Files:**
- Modify: `frontend/app/tarot/page.tsx`

**Interfaces:**
- Consumes: `useAuth`(기존), `useProgress`(Task 8), `consumeTarotUsage`(Task 6), `getKakaoAuthorizeUrl`(기존 `lib/auth.ts`)

- [ ] **Step 1: import 추가**

`frontend/app/tarot/page.tsx`의 최상단 import 블록(현재):

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

다음으로 교체 (3줄 추가):

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
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { consumeTarotUsage } from "../../lib/progress";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
```

- [ ] **Step 2: 컴포넌트 안에 auth/progress 훅과 quota 에러 상태 추가**

`export default function Home() {` 바로 다음 줄(현재 `const [viewMode, setViewMode] = useState<ViewMode>("unset");`로 시작하는 부분) 앞에 추가:

```tsx
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const [quotaError, setQuotaError] = useState<string | null>(null);
```

- [ ] **Step 3: `handleGenerateNumbers`를 async로 바꾸고 사용량 소진 체크 추가**

현재:

```tsx
  function handleGenerateNumbers() {
    if (viewMode === "with-zodiac") {
      if (!selected || !direction) return;
      setPendingNumbers(generateTarotNumbers(selected, zodiac, direction));
    } else {
      if (!spreadReady) return;
      const picks = spreadSlots as CardPick[];
      setPendingNumbers(generateTarotNumbersForPicks(picks, null));
    }
    setAnimating(true);
  }
```

다음으로 교체:

```tsx
  async function handleGenerateNumbers() {
    if (!auth) return;
    setQuotaError(null);
    try {
      await consumeTarotUsage(auth.token);
    } catch (err) {
      setQuotaError(err instanceof Error ? err.message : "오늘 사용 횟수를 다 쓰셨어요.");
      return;
    }
    refreshProgress();
    if (viewMode === "with-zodiac") {
      if (!selected || !direction) return;
      setPendingNumbers(generateTarotNumbers(selected, zodiac, direction));
    } else {
      if (!spreadReady) return;
      const picks = spreadSlots as CardPick[];
      setPendingNumbers(generateTarotNumbersForPicks(picks, null));
    }
    setAnimating(true);
  }
```

- [ ] **Step 4: 로그인 안 됐을 때 보여줄 이른 반환(early return) 추가**

`return (` (메인 JSX를 시작하는 줄, `<div className={styles.page}>`로 시작) 바로 앞에 추가:

```tsx
  if (!auth) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>타로 운세 번호</h1>
          <p className={styles.subtitle}>
            카드로 오늘의 이야기를 만들어 보세요.
            <br />
            실제 운세를 예측하는 것은 아니며, 재미로 참고해 주세요.
          </p>
        </section>
        <div className={styles.card}>
          <p className={styles.hint}>타로를 보려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.generateButton}>
            카카오로 로그인
          </a>
        </div>
      </div>
    );
  }

```

- [ ] **Step 5: 오늘 남은 타로 횟수 안내 표시**

히어로 섹션이 끝나는 지점(현재):

```tsx
      <section className={styles.hero}>
        <h1 className={styles.title}>타로 운세 번호</h1>
        <p className={styles.subtitle}>
          카드로 오늘의 이야기를 만들어 보세요.
          <br />
          실제 운세를 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {viewMode === "unset" && (
```

다음으로 교체 (히어로와 모드 선택 사이에 오늘 남은 횟수 안내 삽입):

```tsx
      <section className={styles.hero}>
        <h1 className={styles.title}>타로 운세 번호</h1>
        <p className={styles.subtitle}>
          카드로 오늘의 이야기를 만들어 보세요.
          <br />
          실제 운세를 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {progress && (
        <p className={styles.hint}>
          오늘 남은 타로 횟수: {progress.tarotUsage.limit - progress.tarotUsage.used}/{progress.tarotUsage.limit} (
          {progress.tier} 등급)
        </p>
      )}

      {viewMode === "unset" && (
```

이 삽입은 아까 만든 로그인 필요 안내용 이른 반환(Step 4)의 `return` 블록이 아니라, 그 아래 메인 `return (` 블록(로그인된 경우에 실제로 렌더링되는 쪽)에 적용한다.

- [ ] **Step 6: 한도 초과 메시지를 두 "번호 뽑기" 버튼 옆에 표시**

첫 번째 "번호 뽑기" 버튼 블록 (`viewMode === "with-zodiac"` 결과 카드 안, 현재):

```tsx
          {!numbers && !animating && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleGenerateNumbers}>
                번호 뽑기
              </button>
              {!zodiac && <p className={styles.hint}>생년월일을 입력하면 별자리 운도 함께 반영돼요.</p>}
            </>
          )}
```

다음으로 교체:

```tsx
          {!numbers && !animating && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleGenerateNumbers}>
                번호 뽑기
              </button>
              {quotaError && <p className={styles.hint}>{quotaError}</p>}
              {!zodiac && <p className={styles.hint}>생년월일을 입력하면 별자리 운도 함께 반영돼요.</p>}
            </>
          )}
```

두 번째 "번호 뽑기" 버튼 블록 (`viewMode === "tarot-only"` 결과 카드 안, 현재):

```tsx
          {!numbers && !animating && (
            <button type="button" className={styles.generateButton} onClick={handleGenerateNumbers}>
              번호 뽑기
            </button>
          )}
```

다음으로 교체:

```tsx
          {!numbers && !animating && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleGenerateNumbers}>
                번호 뽑기
              </button>
              {quotaError && <p className={styles.hint}>{quotaError}</p>}
            </>
          )}
```

- [ ] **Step 7: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 8: Commit**

```bash
git add frontend/app/tarot/page.tsx
git commit -m "Require login and enforce daily quota on the tarot page"
```

---

### Task 10: `/generate` 페이지 로그인 게이트 + 토큰 전달

**Files:**
- Modify: `frontend/app/generate/page.tsx`

**Interfaces:**
- Consumes: `useAuth`(기존), `useProgress`(Task 8), `generateNumbers`(Task 7, 이제 `token` 파라미터 필요), `getKakaoAuthorizeUrl`(기존)

- [ ] **Step 1: import 추가**

현재 import 블록:

```tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./generate.module.css";
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
```

다음으로 교체:

```tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./generate.module.css";
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

- [ ] **Step 2: 컴포넌트 안에 auth/progress 훅 추가**

`export default function GeneratePage() {` 바로 다음 줄에 추가:

```tsx
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
```

- [ ] **Step 3: `handleGenerate`에 토큰 전달 + 진행상황 갱신**

현재:

```tsx
  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data = await generateNumbers(mode, sets);
      if (sets === 1) {
        setResult(null);
        setPendingResult(data);
        setAnimating(true);
      } else {
        setPendingResult(null);
        setAnimating(false);
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }
```

다음으로 교체:

```tsx
  async function handleGenerate() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateNumbers(mode, sets, auth.token);
      refreshProgress();
      if (sets === 1) {
        setResult(null);
        setPendingResult(data);
        setAnimating(true);
      } else {
        setPendingResult(null);
        setAnimating(false);
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }
```

- [ ] **Step 4: 오늘 남은 번호생성 횟수 안내 표시**

히어로 섹션이 끝나는 지점(현재):

```tsx
      <section className={styles.hero}>
        <h1 className={styles.title}>통계 기반 추천 번호</h1>
        <p className={styles.subtitle}>
          역대 로또 6/45 당첨번호의 출현 빈도를 가중치로 삼아 번호를 생성합니다.
          <br />
          실제 당첨을 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {latestDraw && (
```

다음으로 교체:

```tsx
      <section className={styles.hero}>
        <h1 className={styles.title}>통계 기반 추천 번호</h1>
        <p className={styles.subtitle}>
          역대 로또 6/45 당첨번호의 출현 빈도를 가중치로 삼아 번호를 생성합니다.
          <br />
          실제 당첨을 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {progress && (
        <p className={styles.error}>
          오늘 남은 번호생성 횟수: {progress.generateUsage.limit - progress.generateUsage.used}/
          {progress.generateUsage.limit} ({progress.tier} 등급)
        </p>
      )}

      {latestDraw && (
```

(이 페이지의 CSS 모듈엔 `.hint` 클래스가 없어서 기존에 있는 `.error` 클래스를 재사용한다. 실제로 에러는 아니지만 스타일만 빌려쓰는 것 — 새 클래스를 추가하지 않기 위한 선택.)

- [ ] **Step 5: 생성 컨트롤 카드를 로그인 여부에 따라 분기**

현재 (모드 선택 + 세트 수 + 생성 버튼이 있는 카드):

```tsx
      <div className={styles.card}>
        <div className={styles.controlsRow}>
          <div className={styles.segmented}>
            <button
              type="button"
              className={`${styles.segment} ${mode === "weighted" ? styles.segmentActive : ""}`}
              onClick={() => setMode("weighted")}
              disabled={animating}
            >
              가중치 기반
            </button>
            <button
              type="button"
              className={`${styles.segment} ${mode === "random" ? styles.segmentActive : ""}`}
              onClick={() => setMode("random")}
              disabled={animating}
            >
              완전 랜덤
            </button>
          </div>

          <div className={styles.setsField}>
            <span>세트 수</span>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() => setSets((s) => Math.max(1, s - 1))}
                disabled={sets <= 1 || animating}
                aria-label="세트 수 감소"
              >
                −
              </button>
              <span className={styles.stepperValue}>{sets}</span>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() => setSets((s) => Math.min(10, s + 1))}
                disabled={sets >= 10 || animating}
                aria-label="세트 수 증가"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <button className={styles.generateButton} onClick={handleGenerate} disabled={loading || animating}>
          {loading ? "생성 중..." : "번호 생성"}
        </button>
      </div>
```

다음으로 교체 (전체를 `auth` 유무에 따른 조건부로 감쌈):

```tsx
      {auth ? (
        <div className={styles.card}>
          <div className={styles.controlsRow}>
            <div className={styles.segmented}>
              <button
                type="button"
                className={`${styles.segment} ${mode === "weighted" ? styles.segmentActive : ""}`}
                onClick={() => setMode("weighted")}
                disabled={animating}
              >
                가중치 기반
              </button>
              <button
                type="button"
                className={`${styles.segment} ${mode === "random" ? styles.segmentActive : ""}`}
                onClick={() => setMode("random")}
                disabled={animating}
              >
                완전 랜덤
              </button>
            </div>

            <div className={styles.setsField}>
              <span>세트 수</span>
              <div className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepperButton}
                  onClick={() => setSets((s) => Math.max(1, s - 1))}
                  disabled={sets <= 1 || animating}
                  aria-label="세트 수 감소"
                >
                  −
                </button>
                <span className={styles.stepperValue}>{sets}</span>
                <button
                  type="button"
                  className={styles.stepperButton}
                  onClick={() => setSets((s) => Math.min(10, s + 1))}
                  disabled={sets >= 10 || animating}
                  aria-label="세트 수 증가"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <button className={styles.generateButton} onClick={handleGenerate} disabled={loading || animating}>
            {loading ? "생성 중..." : "번호 생성"}
          </button>
        </div>
      ) : (
        <div className={styles.card}>
          <p className={styles.error}>번호 생성을 이용하려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.generateButton}>
            카카오로 로그인
          </a>
        </div>
      )}
```

- [ ] **Step 6: 타입체크 + 전체 프론트 테스트**

Run: `cd frontend && npx tsc --noEmit && npm test`
Expected: 에러 없음, 모든 테스트 통과

- [ ] **Step 7: Commit**

```bash
git add frontend/app/generate/page.tsx
git commit -m "Require login on the generate page and pass auth token"
```

- [ ] **Step 8: 브라우저 수동 확인 + 백엔드 전체 테스트**

로컬에서 `cd backend && ./gradlew build`로 전체 백엔드 테스트가 여전히 통과하는지 확인한다 (Task 5에서 `/api/generate`를 수정했으므로).

로컬 dev 서버(프론트+백엔드, `SPRING_PROFILES_ACTIVE=local`)를 켜고:
1. 로그아웃 상태로 `/tarot`, `/generate` 접속 → 카드/생성 폼 대신 "로그인이 필요해요" 안내 + 로그인 버튼 표시 확인
2. 로그인 후 `/tarot`에서 카드 1장 뽑고 번호 뽑기 → 정상 진행, 두 번째 시도 시 초심자 등급 한도(1회)라 "오늘 사용 횟수를 다 쓰셨어요" 메시지 표시 확인
3. `/generate`에서 번호 생성 1회 → 정상, 두 번째 시도 시 동일하게 한도 초과 메시지 확인
4. 콘솔 에러 없는지 확인
