package com.lottopredictor.backend.draw;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LottoMatchCalculatorTest {

    @Test
    void reportsAFirstPrizeWhenAllSixMainNumbersMatch() {
        LottoDraw draw = new LottoDraw(1230, LocalDate.of(2026, 6, 27), 3, 8, 9, 22, 28, 42, 45);

        LottoMatchCalculator.MatchResult result = LottoMatchCalculator.calculate(List.of(3, 8, 9, 22, 28, 42), draw);

        assertThat(result.matchCount()).isEqualTo(6);
        assertThat(result.rank()).isEqualTo("1등");
    }

    @Test
    void reportsAThirdPrizeWhenFiveMainNumbersMatchWithoutTheBonus() {
        LottoDraw draw = new LottoDraw(1230, LocalDate.of(2026, 6, 27), 3, 8, 9, 22, 28, 42, 45);

        LottoMatchCalculator.MatchResult result = LottoMatchCalculator.calculate(List.of(3, 8, 9, 22, 28, 1), draw);

        assertThat(result.matchCount()).isEqualTo(5);
        assertThat(result.bonusMatch()).isFalse();
        assertThat(result.rank()).isEqualTo("3등");
    }

    @Test
    void reportsNoRankWhenFewerThanThreeMainNumbersMatch() {
        LottoDraw draw = new LottoDraw(1230, LocalDate.of(2026, 6, 27), 3, 8, 9, 22, 28, 42, 45);

        LottoMatchCalculator.MatchResult result = LottoMatchCalculator.calculate(List.of(1, 2, 3, 10, 11, 12), draw);

        assertThat(result.matchCount()).isEqualTo(1);
        assertThat(result.rank()).isNull();
    }
}
