package com.lottopredictor.backend.generate;

import java.util.ArrayList;
import java.util.List;
import java.util.function.DoubleSupplier;

public final class WeightedRandomSampler {

    private WeightedRandomSampler() {
    }

    public static List<Integer> weightedSampleWithoutReplacement(List<NumberWeight> weights, int count) {
        return weightedSampleWithoutReplacement(weights, count, Math::random);
    }

    public static List<Integer> weightedSampleWithoutReplacement(
            List<NumberWeight> weights,
            int count,
            DoubleSupplier rng
    ) {
        List<NumberWeight> pool = new ArrayList<>(weights);
        List<Integer> picked = new ArrayList<>(count);

        for (int i = 0; i < count; i++) {
            double totalWeight = pool.stream().mapToDouble(NumberWeight::weight).sum();

            int idx;
            if (totalWeight <= 0) {
                idx = (int) (rng.getAsDouble() * pool.size());
            } else {
                double r = rng.getAsDouble() * totalWeight;
                idx = 0;
                for (; idx < pool.size(); idx++) {
                    r -= pool.get(idx).weight();
                    if (r <= 0) {
                        break;
                    }
                }
                idx = Math.min(idx, pool.size() - 1);
            }

            picked.add(pool.get(idx).number());
            pool.remove(idx);
        }

        return picked;
    }

    public static List<Integer> uniformSampleWithoutReplacement(int count, int max) {
        return uniformSampleWithoutReplacement(count, max, Math::random);
    }

    public static List<Integer> uniformSampleWithoutReplacement(int count, int max, DoubleSupplier rng) {
        List<Integer> pool = new ArrayList<>(max);
        for (int i = 1; i <= max; i++) {
            pool.add(i);
        }

        List<Integer> picked = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            int idx = (int) (rng.getAsDouble() * pool.size());
            picked.add(pool.get(idx));
            pool.remove(idx);
        }

        return picked;
    }
}
