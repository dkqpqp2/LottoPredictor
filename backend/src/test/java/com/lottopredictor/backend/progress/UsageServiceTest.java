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
