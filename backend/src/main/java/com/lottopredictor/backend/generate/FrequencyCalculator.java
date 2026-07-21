package com.lottopredictor.backend.generate;

import java.util.ArrayList;
import java.util.List;

public final class FrequencyCalculator {

    private static final int MAX_NUMBER = 45;

    private FrequencyCalculator() {
    }

    public static List<NumberWeight> calculate(List<int[]> draws) {
        int[] counts = new int[MAX_NUMBER];

        for (int[] draw : draws) {
            for (int n : draw) {
                counts[n - 1]++;
            }
        }

        List<NumberWeight> weights = new ArrayList<>(MAX_NUMBER);
        for (int i = 0; i < MAX_NUMBER; i++) {
            weights.add(new NumberWeight(i + 1, counts[i]));
        }
        return weights;
    }
}
