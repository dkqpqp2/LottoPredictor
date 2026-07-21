package com.lottopredictor.backend.weeklypick;

import java.time.LocalDate;
import java.util.List;

public record WeeklyPickResult(
        LocalDate weekStart,
        int targetDrawNo,
        List<Integer> numbers,
        boolean resultAvailable,
        Integer matchCount,
        Boolean bonusMatch,
        String rank,
        List<Integer> actualNumbers,
        Integer actualBonus,
        String actualDrawDate
) {
    public static WeeklyPickResult pending(LocalDate weekStart, int targetDrawNo, List<Integer> numbers) {
        return new WeeklyPickResult(weekStart, targetDrawNo, numbers, false, null, null, null, null, null, null);
    }
}
