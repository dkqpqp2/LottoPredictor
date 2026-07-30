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
