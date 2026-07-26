package com.lottopredictor.backend.savednumber;

import java.time.Instant;
import java.util.List;

public record SavedNumberResponse(
        Long id,
        String source,
        int targetDrawNo,
        List<Integer> numbers,
        Instant savedAt,
        boolean resultAvailable,
        Integer matchCount,
        Boolean bonusMatch,
        String rank,
        List<Integer> actualNumbers,
        String actualDrawDate
) {
    public static SavedNumberResponse pending(
            Long id, String source, int targetDrawNo, List<Integer> numbers, Instant savedAt
    ) {
        return new SavedNumberResponse(id, source, targetDrawNo, numbers, savedAt, false, null, null, null, null, null);
    }
}
