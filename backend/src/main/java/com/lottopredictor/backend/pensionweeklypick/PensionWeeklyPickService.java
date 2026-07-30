package com.lottopredictor.backend.pensionweeklypick;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import com.lottopredictor.backend.pensiondraw.PensionMatchCalculator;
import com.lottopredictor.backend.pensiongenerate.PensionGenerateResult;
import com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Service
public class PensionWeeklyPickService {

    private final PensionWeeklyPickRepository pensionWeeklyPickRepository;
    private final PensionDrawRepository pensionDrawRepository;
    private final PensionNumberGenerationService pensionNumberGenerationService;

    public PensionWeeklyPickService(
            PensionWeeklyPickRepository pensionWeeklyPickRepository,
            PensionDrawRepository pensionDrawRepository,
            PensionNumberGenerationService pensionNumberGenerationService
    ) {
        this.pensionWeeklyPickRepository = pensionWeeklyPickRepository;
        this.pensionDrawRepository = pensionDrawRepository;
        this.pensionNumberGenerationService = pensionNumberGenerationService;
    }

    public PensionWeeklyPickResult getCurrent() {
        return toResult(getCurrentPick());
    }

    public List<PensionWeeklyPickResult> getHistory(int limit) {
        PensionWeeklyPick current = getCurrentPick();
        return pensionWeeklyPickRepository
                .findByIdLessThanOrderByIdDesc(current.getId(), PageRequest.of(0, limit))
                .stream()
                .map(this::toResult)
                .toList();
    }

    private PensionWeeklyPick getCurrentPick() {
        return pensionWeeklyPickRepository.findTopByOrderByIdDesc()
                .filter(pick -> !isResolved(pick))
                .orElseGet(() -> generateAndSave(currentWeekStart()));
    }

    private boolean isResolved(PensionWeeklyPick pick) {
        return pensionDrawRepository.existsById(pick.getTargetDrawNo());
    }

    private LocalDate currentWeekStart() {
        return LocalDate.now(ZoneId.of("Asia/Seoul")).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private PensionWeeklyPick generateAndSave(LocalDate weekStart) {
        int targetDrawNo = pensionDrawRepository.findMaxDrawNo().orElse(0) + 1;
        PensionGenerateResult generated = pensionNumberGenerationService.generate();
        PensionWeeklyPick pick = new PensionWeeklyPick(weekStart, targetDrawNo, generated.groupNo(), generated.number());
        return pensionWeeklyPickRepository.save(pick);
    }

    private PensionWeeklyPickResult toResult(PensionWeeklyPick pick) {
        return pensionDrawRepository.findById(pick.getTargetDrawNo())
                .map(draw -> buildAvailableResult(pick, draw))
                .orElseGet(() -> PensionWeeklyPickResult.pending(
                        pick.getWeekStart(), pick.getTargetDrawNo(), pick.getGroupNo(), pick.getNumber()
                ));
    }

    private PensionWeeklyPickResult buildAvailableResult(PensionWeeklyPick pick, PensionDraw draw) {
        PensionMatchCalculator.MatchResult match =
                PensionMatchCalculator.calculate(pick.getGroupNo(), pick.getNumber(), draw);

        return new PensionWeeklyPickResult(
                pick.getWeekStart(),
                pick.getTargetDrawNo(),
                pick.getGroupNo(),
                pick.getNumber(),
                true,
                match.rank(),
                match.bonusMatch(),
                draw.getGroupNo(),
                draw.getNumber(),
                draw.getBonusNumber(),
                draw.getDrawDate().toString()
        );
    }
}
