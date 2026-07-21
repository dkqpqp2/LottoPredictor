package com.lottopredictor.backend.generate;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FrequencyCalculatorTest {

    @Test
    void returnsWeightZeroForEveryNumberWhenThereAreNoDraws() {
        List<NumberWeight> result = FrequencyCalculator.calculate(List.of());

        assertThat(result).hasSize(45);
        assertThat(result).allSatisfy(w -> assertThat(w.weight()).isZero());
    }

    @Test
    void countsHowManyTimesEachNumberAppearsAcrossDraws() {
        List<int[]> draws = List.of(
                new int[] { 1, 2, 3, 4, 5, 6 },
                new int[] { 1, 2, 3, 7, 8, 9 }
        );

        List<NumberWeight> result = FrequencyCalculator.calculate(draws);

        assertThat(weightOf(result, 1)).isEqualTo(2);
        assertThat(weightOf(result, 2)).isEqualTo(2);
        assertThat(weightOf(result, 3)).isEqualTo(2);
        assertThat(weightOf(result, 4)).isEqualTo(1);
        assertThat(weightOf(result, 10)).isEqualTo(0);
    }

    private static double weightOf(List<NumberWeight> weights, int number) {
        return weights.stream()
                .filter(w -> w.number() == number)
                .findFirst()
                .orElseThrow()
                .weight();
    }
}
