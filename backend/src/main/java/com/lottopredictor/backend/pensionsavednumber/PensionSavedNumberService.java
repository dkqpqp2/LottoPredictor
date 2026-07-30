package com.lottopredictor.backend.pensionsavednumber;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import com.lottopredictor.backend.pensiondraw.PensionMatchCalculator;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class PensionSavedNumberService {

    private final PensionSavedNumberRepository pensionSavedNumberRepository;
    private final PensionDrawRepository pensionDrawRepository;

    public PensionSavedNumberService(
            PensionSavedNumberRepository pensionSavedNumberRepository,
            PensionDrawRepository pensionDrawRepository
    ) {
        this.pensionSavedNumberRepository = pensionSavedNumberRepository;
        this.pensionDrawRepository = pensionDrawRepository;
    }

    public PensionSavedNumberResponse save(Long userId, int groupNo, String number) {
        int targetDrawNo = pensionDrawRepository.findMaxDrawNo().orElse(0) + 1;
        PensionSavedNumber entity = new PensionSavedNumber(userId, targetDrawNo, groupNo, number, Instant.now());
        return toResponse(pensionSavedNumberRepository.save(entity));
    }

    public List<PensionSavedNumberResponse> getSaved(Long userId) {
        return pensionSavedNumberRepository.findByUserIdOrderBySavedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private PensionSavedNumberResponse toResponse(PensionSavedNumber entity) {
        return pensionDrawRepository.findById(entity.getTargetDrawNo())
                .map(draw -> buildAvailableResponse(entity, draw))
                .orElseGet(() -> PensionSavedNumberResponse.pending(
                        entity.getId(), entity.getTargetDrawNo(), entity.getGroupNo(), entity.getNumber(), entity.getSavedAt()
                ));
    }

    private PensionSavedNumberResponse buildAvailableResponse(PensionSavedNumber entity, PensionDraw draw) {
        PensionMatchCalculator.MatchResult match =
                PensionMatchCalculator.calculate(entity.getGroupNo(), entity.getNumber(), draw);

        return new PensionSavedNumberResponse(
                entity.getId(),
                entity.getTargetDrawNo(),
                entity.getGroupNo(),
                entity.getNumber(),
                entity.getSavedAt(),
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
