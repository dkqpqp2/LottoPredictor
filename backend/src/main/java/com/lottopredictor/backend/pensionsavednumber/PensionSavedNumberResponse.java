package com.lottopredictor.backend.pensionsavednumber;

import java.time.Instant;

public record PensionSavedNumberResponse(
        Long id,
        int targetDrawNo,
        int groupNo,
        String number,
        Instant savedAt,
        boolean resultAvailable,
        String rank,
        Boolean bonusMatch,
        Integer actualGroupNo,
        String actualNumber,
        String actualBonusNumber,
        String actualDrawDate
) {
    public static PensionSavedNumberResponse pending(
            Long id, int targetDrawNo, int groupNo, String number, Instant savedAt
    ) {
        return new PensionSavedNumberResponse(
                id, targetDrawNo, groupNo, number, savedAt, false, null, null, null, null, null, null
        );
    }
}
