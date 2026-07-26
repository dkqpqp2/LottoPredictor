package com.lottopredictor.backend.admin;

import com.lottopredictor.backend.auth.User;
import com.lottopredictor.backend.auth.UserRepository;
import com.lottopredictor.backend.progress.DailyUsageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DailyUsageRepository dailyUsageRepository;

    private User newUser() {
        return new User(123L, "홍길동");
    }

    @Test
    void listUsersReportsTheEffectiveTierForEachUser() {
        User beginner = newUser();
        User forced = newUser();
        forced.setForcedTier("LOTTO_GOD");
        when(userRepository.findAll()).thenReturn(List.of(beginner, forced));

        AdminService service = new AdminService(userRepository, dailyUsageRepository);
        List<AdminUserResponse> result = service.listUsers();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).tier()).isEqualTo("뽑기 초심자");
        assertThat(result.get(0).forcedTier()).isNull();
        assertThat(result.get(1).tier()).isEqualTo("뽑기의 신");
        assertThat(result.get(1).forcedTier()).isEqualTo("LOTTO_GOD");
    }

    @Test
    void setForcedTierOverridesTheUsersTierRegardlessOfPoints() {
        User user = newUser();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        AdminService service = new AdminService(userRepository, dailyUsageRepository);
        AdminUserResponse response = service.setForcedTier(1L, "EXPERT");

        assertThat(response.tier()).isEqualTo("뽑기 고수");
        assertThat(response.forcedTier()).isEqualTo("EXPERT");
    }

    @Test
    void setForcedTierWithNullClearsTheOverride() {
        User user = newUser();
        user.setForcedTier("LOTTO_GOD");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        AdminService service = new AdminService(userRepository, dailyUsageRepository);
        AdminUserResponse response = service.setForcedTier(1L, null);

        assertThat(response.tier()).isEqualTo("뽑기 초심자");
        assertThat(response.forcedTier()).isNull();
    }

    @Test
    void resetTodayUsageDeletesTheUsersDailyUsageRowsForToday() {
        AdminService service = new AdminService(userRepository, dailyUsageRepository);

        service.resetTodayUsage(1L);

        verify(dailyUsageRepository).deleteByUserIdAndUsageDate(1L, LocalDate.now());
    }
}
