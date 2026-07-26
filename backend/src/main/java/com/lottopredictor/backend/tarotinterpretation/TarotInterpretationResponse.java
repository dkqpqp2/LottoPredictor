package com.lottopredictor.backend.tarotinterpretation;

import java.time.Instant;
import java.util.List;

public record TarotInterpretationResponse(
        Long id,
        String mode,
        List<TarotInterpretationRequest.CardInput> cards,
        String zodiacName,
        String interpretationText,
        Instant createdAt
) {
}
