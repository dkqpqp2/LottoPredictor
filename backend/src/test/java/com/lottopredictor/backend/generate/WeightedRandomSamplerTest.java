package com.lottopredictor.backend.generate;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class WeightedRandomSamplerTest {

    @Test
    void uniformSampleReturnsSixDistinctNumbersInRange() {
        List<Integer> result = WeightedRandomSampler.uniformSampleWithoutReplacement(6, 45);

        assertThat(result).hasSize(6);
        assertThat(new HashSet<>(result)).hasSize(6);
        assertThat(result).allSatisfy(n -> assertThat(n).isBetween(1, 45));
    }

    @Test
    void uniformSampleIsDeterministicGivenAFixedRng() {
        List<Integer> result = WeightedRandomSampler.uniformSampleWithoutReplacement(6, 45, () -> 0.0);

        assertThat(result).containsExactly(1, 2, 3, 4, 5, 6);
    }

    @Test
    void weightedSampleReturnsSixDistinctNumbers() {
        List<NumberWeight> weights = IntStream.rangeClosed(1, 45)
                .mapToObj(n -> new NumberWeight(n, 1))
                .collect(Collectors.toList());

        List<Integer> result = WeightedRandomSampler.weightedSampleWithoutReplacement(weights, 6);

        assertThat(result).hasSize(6);
        assertThat(new HashSet<>(result)).hasSize(6);
    }

    @Test
    void weightedSamplePicksAHeavilyWeightedNumberFarMoreOften() {
        List<NumberWeight> weights = IntStream.rangeClosed(1, 45)
                .mapToObj(n -> new NumberWeight(n, n == 7 ? 1000 : 1))
                .collect(Collectors.toList());

        int trials = 500;
        long countOf7 = IntStream.range(0, trials)
                .filter(i -> WeightedRandomSampler.weightedSampleWithoutReplacement(weights, 6).contains(7))
                .count();

        // Baseline (equal weights) chance of one number appearing in a 6-of-45 draw is ~13%.
        // A 1000x weight should push this near 100%.
        assertThat((double) countOf7 / trials).isGreaterThan(0.9);
    }

    @Test
    void weightedSampleFallsBackToUniformWhenAllWeightsAreZero() {
        List<NumberWeight> weights = IntStream.rangeClosed(1, 45)
                .mapToObj(n -> new NumberWeight(n, 0))
                .collect(Collectors.toList());

        List<Integer> result = WeightedRandomSampler.weightedSampleWithoutReplacement(weights, 6);

        assertThat(result).hasSize(6);
        assertThat(new HashSet<>(result)).hasSize(6);
    }
}
