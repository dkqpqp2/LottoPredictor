package com.lottopredictor.backend.generate;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.function.DoubleSupplier;

@Service
public class NumberGenerationService {

    private final LottoDrawRepository repository;

    public NumberGenerationService(LottoDrawRepository repository) {
        this.repository = repository;
    }

    public GenerateResult generate(String mode, int sets) {
        return generate(mode, sets, Math::random);
    }

    GenerateResult generate(String mode, int sets, DoubleSupplier rng) {
        List<int[]> draws = repository.findAll().stream().map(LottoDraw::numbers).toList();
        boolean useWeighted = "weighted".equals(mode) && !draws.isEmpty();

        List<NumberWeight> weights = useWeighted ? FrequencyCalculator.calculate(draws) : null;

        List<List<Integer>> results = new ArrayList<>(sets);
        for (int i = 0; i < sets; i++) {
            List<Integer> numbers = useWeighted
                    ? WeightedRandomSampler.weightedSampleWithoutReplacement(weights, 6, rng)
                    : WeightedRandomSampler.uniformSampleWithoutReplacement(6, 45, rng);
            List<Integer> sorted = new ArrayList<>(numbers);
            sorted.sort(Integer::compareTo);
            results.add(sorted);
        }

        return new GenerateResult(useWeighted ? "weighted" : "random", results);
    }
}
