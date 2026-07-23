package com.lottopredictor.backend.stats;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import com.lottopredictor.backend.generate.FrequencyCalculator;
import com.lottopredictor.backend.generate.NumberWeight;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class StatsService {

    private final LottoDrawRepository repository;

    public StatsService(LottoDrawRepository repository) {
        this.repository = repository;
    }

    public List<NumberStat> computeStats() {
        List<LottoDraw> draws = repository.findAll();
        List<int[]> numbers = draws.stream().map(LottoDraw::numbers).toList();
        List<NumberWeight> frequencies = FrequencyCalculator.calculate(numbers);

        int totalDraws = draws.size();
        return frequencies.stream()
                .map(w -> new NumberStat(
                        w.number(),
                        (long) w.weight(),
                        totalDraws == 0 ? 0.0 : (w.weight() / totalDraws) * 100
                ))
                .toList();
    }

    public List<DuplicateDrawGroup> findDuplicateCombinations() {
        List<LottoDraw> draws = repository.findAll();
        Map<String, List<Integer>> numbersByCombo = new LinkedHashMap<>();
        Map<String, List<Integer>> drawNosByCombo = new LinkedHashMap<>();

        for (LottoDraw draw : draws) {
            List<Integer> sorted = Arrays.stream(draw.numbers()).boxed().sorted().toList();
            String key = sorted.toString();
            numbersByCombo.putIfAbsent(key, sorted);
            drawNosByCombo.computeIfAbsent(key, k -> new ArrayList<>()).add(draw.getDrawNo());
        }

        return drawNosByCombo.entrySet().stream()
                .filter(entry -> entry.getValue().size() > 1)
                .map(entry -> {
                    List<Integer> drawNos = new ArrayList<>(entry.getValue());
                    Collections.sort(drawNos);
                    return new DuplicateDrawGroup(numbersByCombo.get(entry.getKey()), drawNos);
                })
                .toList();
    }
}
