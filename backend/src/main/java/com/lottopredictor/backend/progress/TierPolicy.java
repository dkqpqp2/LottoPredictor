package com.lottopredictor.backend.progress;

import java.util.Map;

public final class TierPolicy {

    private TierPolicy() {
    }

    private record DailyLimits(int tarot, int generate) {
    }

    private static final Map<Tier, DailyLimits> DAILY_LIMITS = Map.of(
            Tier.BEGINNER, new DailyLimits(1, 1),
            Tier.APPRENTICE, new DailyLimits(1, 2),
            Tier.EXPERT, new DailyLimits(1, 3),
            Tier.MASTER, new DailyLimits(1, 5),
            Tier.LOTTO_GOD, new DailyLimits(Integer.MAX_VALUE, Integer.MAX_VALUE)
    );

    private static final Map<Tier, Integer> MAX_SETS = Map.of(
            Tier.BEGINNER, 2,
            Tier.APPRENTICE, 4,
            Tier.EXPERT, 6,
            Tier.MASTER, 8,
            Tier.LOTTO_GOD, 10
    );

    public static Tier tierForPoints(int totalPoints) {
        if (totalPoints >= 350) return Tier.MASTER;
        if (totalPoints >= 150) return Tier.EXPERT;
        if (totalPoints >= 50) return Tier.APPRENTICE;
        return Tier.BEGINNER;
    }

    public static int dailyLimit(Tier tier, Feature feature) {
        DailyLimits limits = DAILY_LIMITS.get(tier);
        return feature == Feature.TAROT ? limits.tarot() : limits.generate();
    }

    public static int maxSets(Tier tier) {
        return MAX_SETS.get(tier);
    }

    public static Integer pointsToNextTier(int totalPoints) {
        Tier tier = tierForPoints(totalPoints);
        return switch (tier) {
            case BEGINNER -> 50 - totalPoints;
            case APPRENTICE -> 150 - totalPoints;
            case EXPERT -> 350 - totalPoints;
            case MASTER, LOTTO_GOD -> null;
        };
    }
}
