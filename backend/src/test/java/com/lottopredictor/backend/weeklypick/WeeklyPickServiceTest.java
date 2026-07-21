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
    void generatesAndSavesANewPickWhenNoneExistsForTheCurrentWeek() {
        when(weeklyPickRepository.findById(any(LocalDate.class))).thenReturn(Optional.empty());
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
    void reusesAnExistingPickInsteadOfGeneratingANewOne() {
        LocalDate weekStart = LocalDate.of(2026, 7, 20);
        WeeklyPick existing = new WeeklyPick(weekStart, 1234, 1, 2, 3, 4, 5, 6, "weighted");
        when(weeklyPickRepository.findById(any(LocalDate.class))).thenReturn(Optional.of(existing));
        when(lottoDrawRepository.findById(1234)).thenReturn(Optional.empty());

        WeeklyPickService service =
                new WeeklyPickService(weeklyPickRepository, lottoDrawRepository, numberGenerationService);
        WeeklyPickResult result = service.getCurrentWeekResult();

        assertThat(result.targetDrawNo()).isEqualTo(1234);
        verifyNoInteractions(numberGenerationService);
    }

    @Test
    void computesMatchCountAndRankWhenTheTargetDrawIsAvailable() {
        LocalDate weekStart = LocalDate.of(2026, 7, 6);
        WeeklyPick existing = new WeeklyPick(weekStart, 1230, 3, 8, 9, 22, 28, 1, "weighted");
        when(weeklyPickRepository.findById(any(LocalDate.class))).thenReturn(Optional.of(existing));
        LottoDraw draw = new LottoDraw(1230, LocalDate.of(2026, 6, 27), 3, 8, 9, 22, 28, 42, 45);
        when(lottoDrawRepository.findById(1230)).thenReturn(Optional.of(draw));

        WeeklyPickService service =
                new WeeklyPickService(weeklyPickRepository, lottoDrawRepository, numberGenerationService);
        WeeklyPickResult result = service.getCurrentWeekResult();

        assertThat(result.resultAvailable()).isTrue();
        assertThat(result.matchCount()).isEqualTo(5);
        assertThat(result.bonusMatch()).isFalse();
        assertThat(result.rank()).isEqualTo("3등");
    }
}
