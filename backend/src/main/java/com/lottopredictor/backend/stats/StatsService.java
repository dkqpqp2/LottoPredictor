package com.lottopredictor.backend.stats;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import com.lottopredictor.backend.generate.FrequencyCalculator;
import com.lottopredictor.backend.generate.NumberWeight;
import org.springframework.stereotype.Service;

import java.util.List;

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
}
