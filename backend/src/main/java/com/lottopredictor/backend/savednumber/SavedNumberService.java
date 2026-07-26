package com.lottopredictor.backend.savednumber;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import com.lottopredictor.backend.draw.LottoMatchCalculator;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class SavedNumberService {

    private final SavedNumberRepository savedNumberRepository;
    private final LottoDrawRepository lottoDrawRepository;

    public SavedNumberService(SavedNumberRepository savedNumberRepository, LottoDrawRepository lottoDrawRepository) {
        this.savedNumberRepository = savedNumberRepository;
        this.lottoDrawRepository = lottoDrawRepository;
    }

    public SavedNumberResponse save(Long userId, String source, List<Integer> numbers) {
        int targetDrawNo = lottoDrawRepository.findMaxDrawNo().orElse(0) + 1;
        SavedNumber entity = new SavedNumber(
                userId,
                source,
                targetDrawNo,
                numbers.get(0),
                numbers.get(1),
                numbers.get(2),
                numbers.get(3),
                numbers.get(4),
                numbers.get(5),
                Instant.now()
        );
        return toResponse(savedNumberRepository.save(entity));
    }

    public List<SavedNumberResponse> getSaved(Long userId) {
        return savedNumberRepository.findByUserIdOrderBySavedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private SavedNumberResponse toResponse(SavedNumber entity) {
        List<Integer> numbers = entity.numbers();
        return lottoDrawRepository.findById(entity.getTargetDrawNo())
                .map(draw -> buildAvailableResponse(entity, numbers, draw))
                .orElseGet(() -> SavedNumberResponse.pending(
                        entity.getId(), entity.getSource(), entity.getTargetDrawNo(), numbers, entity.getSavedAt()
                ));
    }

    private SavedNumberResponse buildAvailableResponse(SavedNumber entity, List<Integer> numbers, LottoDraw draw) {
        LottoMatchCalculator.MatchResult match = LottoMatchCalculator.calculate(numbers, draw);

        List<Integer> actualNumbers = new ArrayList<>();
        for (int n : draw.numbers()) {
            actualNumbers.add(n);
        }

        return new SavedNumberResponse(
                entity.getId(),
                entity.getSource(),
                entity.getTargetDrawNo(),
                numbers,
                entity.getSavedAt(),
                true,
                match.matchCount(),
                match.bonusMatch(),
                match.rank(),
                actualNumbers,
                draw.getDrawDate().toString()
        );
    }
}
