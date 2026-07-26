package com.lottopredictor.backend.tarotinterpretation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class TarotInterpretationService {

    private final TarotInterpretationRepository repository;
    private final UsageService usageService;
    private final ClaudeTarotInterpreter interpreter;
    private final ObjectMapper objectMapper;

    public TarotInterpretationService(
            TarotInterpretationRepository repository,
            UsageService usageService,
            ClaudeTarotInterpreter interpreter,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.usageService = usageService;
        this.interpreter = interpreter;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Optional<TarotInterpretationResponse> interpret(Long userId, TarotInterpretationRequest request) {
        if (!usageService.consume(userId, Feature.TAROT)) {
            return Optional.empty();
        }

        String text = interpreter.interpret(buildPrompt(request));
        String cardsJson = writeCardsJson(request.cards());

        TarotInterpretation saved = repository.save(new TarotInterpretation(
                userId, request.mode(), cardsJson, request.zodiacName(), text, Instant.now()
        ));
        return Optional.of(toResponse(saved));
    }

    public List<TarotInterpretationResponse> getHistory(Long userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toResponse).toList();
    }

    private String buildPrompt(TarotInterpretationRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("TAROT_ONLY".equals(request.mode())
                ? "아래는 사용자가 뽑은 타로 3장(과거/현재/미래)입니다.\n"
                : "아래는 사용자가 뽑은 타로 1장입니다.\n");
        for (TarotInterpretationRequest.CardInput card : request.cards()) {
            sb.append("- ");
            if (card.positionLabel() != null) {
                sb.append("[").append(card.positionLabel()).append("] ");
            }
            sb.append(card.nameKo())
                    .append(" (키워드: ").append(card.keyword())
                    .append(", 방향: ").append(directionLabel(card.direction()))
                    .append(")\n");
        }
        if (request.zodiacName() != null) {
            sb.append("사용자의 별자리는 ").append(request.zodiacName()).append("입니다.\n");
        }
        sb.append("이 카드들을 하나의 이야기로 엮어서 종합 해석을 3~5문장으로 작성해줘.");
        return sb.toString();
    }

    private String directionLabel(String direction) {
        return switch (direction) {
            case "up" -> "위";
            case "down" -> "아래";
            case "left" -> "왼쪽";
            case "right" -> "오른쪽";
            default -> direction;
        };
    }

    private String writeCardsJson(List<TarotInterpretationRequest.CardInput> cards) {
        try {
            return objectMapper.writeValueAsString(cards);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("failed to serialize tarot cards", e);
        }
    }

    private List<TarotInterpretationRequest.CardInput> readCardsJson(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<List<TarotInterpretationRequest.CardInput>>() {
            });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("failed to deserialize tarot cards", e);
        }
    }

    private TarotInterpretationResponse toResponse(TarotInterpretation entity) {
        return new TarotInterpretationResponse(
                entity.getId(),
                entity.getMode(),
                readCardsJson(entity.getCardsJson()),
                entity.getZodiac(),
                entity.getInterpretationText(),
                entity.getCreatedAt()
        );
    }
}
