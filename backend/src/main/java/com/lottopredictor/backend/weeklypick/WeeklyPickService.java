package com.lottopredictor.backend.weeklypick;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import com.lottopredictor.backend.draw.LottoMatchCalculator;
import com.lottopredictor.backend.generate.GenerateResult;
import com.lottopredictor.backend.generate.NumberGenerationService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

@Service
public class WeeklyPickService {

    private final WeeklyPickRepository weeklyPickRepository;
    private final LottoDrawRepository lottoDrawRepository;
    private final NumberGenerationService numberGenerationService;

    public WeeklyPickService(
            WeeklyPickRepository weeklyPickRepository,
            LottoDrawRepository lottoDrawRepository,
            NumberGenerationService numberGenerationService
    ) {
        this.weeklyPickRepository = weeklyPickRepository;
        this.lottoDrawRepository = lottoDrawRepository;
        this.numberGenerationService = numberGenerationService;
    }

    public WeeklyPickResult getCurrentWeekResult() {
        return toResult(getCurrentPick());
    }

    public List<WeeklyPickResult> getHistory(int limit) {
        WeeklyPick current = getCurrentPick();
        return weeklyPickRepository
                .findByIdLessThanOrderByIdDesc(current.getId(), PageRequest.of(0, limit))
                .stream()
                .map(this::toResult)
                .toList();
    }

    private WeeklyPick getCurrentPick() {
        return weeklyPickRepository.findTopByOrderByIdDesc()
                .filter(pick -> !isResolved(pick))
                .orElseGet(() -> generateAndSave(currentWeekStart()));
    }

    private boolean isResolved(WeeklyPick pick) {
        return lottoDrawRepository.existsById(pick.getTargetDrawNo());
    }

    private LocalDate currentWeekStart() {
        return LocalDate.now(ZoneId.of("Asia/Seoul")).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private WeeklyPick generateAndSave(LocalDate weekStart) {
        int targetDrawNo = lottoDrawRepository.findMaxDrawNo().orElse(0) + 1;
        GenerateResult generated = numberGenerationService.generate("weighted", 1);
        List<Integer> numbers = generated.results().get(0);
        WeeklyPick pick = new WeeklyPick(
                weekStart,
                targetDrawNo,
                numbers.get(0),
                numbers.get(1),
                numbers.get(2),
                numbers.get(3),
                numbers.get(4),
                numbers.get(5),
                generated.mode()
        );
        return weeklyPickRepository.save(pick);
    }

    private WeeklyPickResult toResult(WeeklyPick pick) {
        return lottoDrawRepository.findById(pick.getTargetDrawNo())
                .map(draw -> buildAvailableResult(pick, draw))
                .orElseGet(() -> WeeklyPickResult.pending(pick.getWeekStart(), pick.getTargetDrawNo(), pick.numbers()));
    }

    private WeeklyPickResult buildAvailableResult(WeeklyPick pick, LottoDraw draw) {
        List<Integer> pickNumbers = pick.numbers();
        LottoMatchCalculator.MatchResult match = LottoMatchCalculator.calculate(pickNumbers, draw);

        List<Integer> actualNumbers = new ArrayList<>();
        for (int n : draw.numbers()) {
            actualNumbers.add(n);
        }

        return new WeeklyPickResult(
                pick.getWeekStart(),
                pick.getTargetDrawNo(),
                pickNumbers,
                true,
                match.matchCount(),
                match.bonusMatch(),
                match.rank(),
                actualNumbers,
                draw.getBonusNum(),
                draw.getDrawDate().toString()
        );
    }
}
