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
