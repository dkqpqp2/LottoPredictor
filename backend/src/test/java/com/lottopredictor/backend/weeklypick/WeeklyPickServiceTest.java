package com.lottopredictor.backend.weeklypick;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import com.lottopredictor.backend.generate.GenerateResult;
import com.lottopredictor.backend.generate.NumberGenerationService;
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
class WeeklyPickServiceTest {

    @Mock
    private WeeklyPickRepository weeklyPickRepository;

    @Mock
    private LottoDrawRepository lottoDrawRepository;

    @Mock
    private NumberGenerationService numberGenerationService;

    @Test
    void generatesAndSavesANewPickWhenNoneExistsYet() {
        when(weeklyPickRepository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());
        when(lottoDrawRepository.findMaxDrawNo()).thenReturn(Optional.of(1233));
        when(numberGenerationService.generate("weighted", 1))
                .thenReturn(new GenerateResult("weighted", List.of(List.of(1, 2, 3, 4, 5, 6))));
        when(weeklyPickRepository.save(any(WeeklyPick.class))).thenAnswer(inv -> inv.getArgument(0));
        when(lottoDrawRepository.findById(1234)).thenReturn(Optional.empty());

        WeeklyPickService service =
                new WeeklyPickService(weeklyPickRepository, lottoDrawRepository, numberGenerationService);
        WeeklyPickResult result = service.getCurrentWeekResult();

        assertThat(result.targetDrawNo()).isEqualTo(1234);
        assertThat(result.numbers()).containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(result.resultAvailable()).isFalse();
    }

    @Test
    void reusesTheCurrentPickWhenItsTargetDrawIsNotYetResolved() {
        LocalDate weekStart = LocalDate.of(2026, 7, 20);
        WeeklyPick existing = new WeeklyPick(weekStart, 1234, 1, 2, 3, 4, 5, 6, "weighted");
        when(weeklyPickRepository.findTopByOrderByIdDesc()).thenReturn(Optional.of(existing));
        when(lottoDrawRepository.existsById(1234)).thenReturn(false);
        when(lottoDrawRepository.findById(1234)).thenReturn(Optional.empty());

        WeeklyPickService service =
                new WeeklyPickService(weeklyPickRepository, lottoDrawRepository, numberGenerationService);
        WeeklyPickResult result = service.getCurrentWeekResult();

        assertThat(result.targetDrawNo()).isEqualTo(1234);
        verifyNoInteractions(numberGenerationService);
    }

    @Test
    void advancesToANewPickOnceTheCurrentTargetDrawIsResolved() {
        LocalDate weekStart = LocalDate.of(2026, 7, 6);
        WeeklyPick resolved = new WeeklyPick(weekStart, 1234, 3, 8, 9, 22, 28, 1, "weighted");
        when(weeklyPickRepository.findTopByOrderByIdDesc()).thenReturn(Optional.of(resolved));
        when(lottoDrawRepository.existsById(1234)).thenReturn(true);
        when(lottoDrawRepository.findMaxDrawNo()).thenReturn(Optional.of(1234));
        when(numberGenerationService.generate("weighted", 1))
                .thenReturn(new GenerateResult("weighted", List.of(List.of(7, 16, 22, 26, 30, 35))));
        when(weeklyPickRepository.save(any(WeeklyPick.class))).thenAnswer(inv -> inv.getArgument(0));
        when(lottoDrawRepository.findById(1235)).thenReturn(Optional.empty());

        WeeklyPickService service =
                new WeeklyPickService(weeklyPickRepository, lottoDrawRepository, numberGenerationService);
        WeeklyPickResult result = service.getCurrentWeekResult();

        assertThat(result.targetDrawNo()).isEqualTo(1235);
        assertThat(result.numbers()).containsExactly(7, 16, 22, 26, 30, 35);
        assertThat(result.resultAvailable()).isFalse();
        verify(weeklyPickRepository).save(any(WeeklyPick.class));
    }

    @Test
    void historyReportsMatchCountAndRankForAResolvedPastPick() {
        WeeklyPick current = new WeeklyPick(LocalDate.of(2026, 7, 20), 1235, 7, 16, 22, 26, 30, 35, "weighted");
        WeeklyPick past = new WeeklyPick(LocalDate.of(2026, 7, 6), 1230, 3, 8, 9, 22, 28, 1, "weighted");
        when(weeklyPickRepository.findTopByOrderByIdDesc()).thenReturn(Optional.of(current));
        when(lottoDrawRepository.existsById(1235)).thenReturn(false);
        when(weeklyPickRepository.findByIdLessThanOrderByIdDesc(eq(current.getId()), any()))
                .thenReturn(List.of(past));
        LottoDraw draw = new LottoDraw(1230, LocalDate.of(2026, 6, 27), 3, 8, 9, 22, 28, 42, 45);
        when(lottoDrawRepository.findById(1230)).thenReturn(Optional.of(draw));

        WeeklyPickService service =
                new WeeklyPickService(weeklyPickRepository, lottoDrawRepository, numberGenerationService);
        List<WeeklyPickResult> history = service.getHistory(5);

        assertThat(history).hasSize(1);
        WeeklyPickResult result = history.get(0);
        assertThat(result.resultAvailable()).isTrue();
        assertThat(result.matchCount()).isEqualTo(5);
        assertThat(result.bonusMatch()).isFalse();
        assertThat(result.rank()).isEqualTo("3등");
    }
}
