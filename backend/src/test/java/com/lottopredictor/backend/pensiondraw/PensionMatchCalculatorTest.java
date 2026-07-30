package com.lottopredictor.backend.pensiondraw;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PensionMatchCalculatorTest {

    private static final LocalDate DRAW_DATE = LocalDate.of(2026, 7, 23);

    @Test
    void reportsFirstPrizeWhenGroupAndAllSixDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "123456", draw);

        assertThat(result.rank()).isEqualTo("1등");
        assertThat(result.bonusMatch()).isFalse();
    }

    @Test
    void reportsSecondPrizeWhenAllSixDigitsMatchButGroupDiffers() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(1, "123456", draw);

        assertThat(result.rank()).isEqualTo("2등");
    }

    @Test
    void reportsThirdPrizeWhenLastFiveDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "223456", draw);

        assertThat(result.rank()).isEqualTo("3등");
    }

    @Test
    void reportsFourthPrizeWhenLastFourDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "213456", draw);

        assertThat(result.rank()).isEqualTo("4등");
    }

    @Test
    void reportsFifthPrizeWhenLastThreeDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "124456", draw);

        assertThat(result.rank()).isEqualTo("5등");
    }

    @Test
    void reportsSixthPrizeWhenLastTwoDigitsMatch() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "123356", draw);

        assertThat(result.rank()).isEqualTo("6등");
    }

    @Test
    void reportsSeventhPrizeWhenLastDigitMatches() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "123446", draw);

        assertThat(result.rank()).isEqualTo("7등");
    }

    @Test
    void reportsNoRankWhenLastDigitDiffers() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "654321");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(3, "123457", draw);

        assertThat(result.rank()).isNull();
    }

    @Test
    void reportsBonusMatchIndependentlyOfTheMainRank() {
        PensionDraw draw = new PensionDraw(325, DRAW_DATE, 3, "123456", "999456");

        PensionMatchCalculator.MatchResult result = PensionMatchCalculator.calculate(1, "999456", draw);

        assertThat(result.rank()).isEqualTo("5등");
        assertThat(result.bonusMatch()).isTrue();
    }
}
