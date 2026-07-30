package com.lottopredictor.backend.pensionweeklypick;

import java.time.LocalDate;

public record PensionWeeklyPickResult(
        LocalDate weekStart,
        int targetDrawNo,
        int groupNo,
        String number,
        boolean resultAvailable,
        String rank,
        Boolean bonusMatch,
        Integer actualGroupNo,
        String actualNumber,
        String actualBonusNumber,
        String actualDrawDate
) {
    public static PensionWeeklyPickResult pending(LocalDate weekStart, int targetDrawNo, int groupNo, String number) {
        return new PensionWeeklyPickResult(
                weekStart, targetDrawNo, groupNo, number, false, null, null, null, null, null, null
        );
    }
}
