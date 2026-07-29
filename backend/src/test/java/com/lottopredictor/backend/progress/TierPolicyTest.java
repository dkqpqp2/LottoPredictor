package com.lottopredictor.backend.progress;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TierPolicyTest {

    @Test
    void mapsZeroPointsToBeginner() {
        assertThat(TierPolicy.tierForPoints(0)).isEqualTo(Tier.BEGINNER);
        assertThat(TierPolicy.tierForPoints(49)).isEqualTo(Tier.BEGINNER);
    }

    @Test
    void mapsFiftyPointsToApprentice() {
        assertThat(TierPolicy.tierForPoints(50)).isEqualTo(Tier.APPRENTICE);
        assertThat(TierPolicy.tierForPoints(149)).isEqualTo(Tier.APPRENTICE);
    }

    @Test
    void mapsOneHundredFiftyPointsAndAboveToExpertWithNoUpperBound() {
        assertThat(TierPolicy.tierForPoints(150)).isEqualTo(Tier.EXPERT);
        assertThat(TierPolicy.tierForPoints(10_000)).isEqualTo(Tier.EXPERT);
    }

    @Test
    void neverReturnsLottoGodFromPoints() {
        for (int points = 0; points <= 5000; points += 37) {
            assertThat(TierPolicy.tierForPoints(points)).isNotEqualTo(Tier.LOTTO_GOD);
        }
    }

    @Test
    void beginnerHasOneUsePerFeaturePerDay() {
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.TAROT)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.GENERATE)).isEqualTo(1);
    }

    @Test
    void generateDailyLimitScalesWithTier() {
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.GENERATE)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.APPRENTICE, Feature.GENERATE)).isEqualTo(3);
        assertThat(TierPolicy.dailyLimit(Tier.EXPERT, Feature.GENERATE)).isEqualTo(5);
    }

    @Test
    void tarotIsCappedAtOnePerDayForEveryTierIncludingLottoGod() {
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.TAROT)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.APPRENTICE, Feature.TAROT)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.EXPERT, Feature.TAROT)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.TAROT)).isEqualTo(1);
    }

    @Test
    void lottoGodHasUnlimitedGenerateUsesButNotTarot() {
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.GENERATE)).isEqualTo(Integer.MAX_VALUE);
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.TAROT)).isEqualTo(1);
    }

    @Test
    void maxSetsScalesWithTier() {
        assertThat(TierPolicy.maxSets(Tier.BEGINNER)).isEqualTo(2);
        assertThat(TierPolicy.maxSets(Tier.APPRENTICE)).isEqualTo(3);
        assertThat(TierPolicy.maxSets(Tier.EXPERT)).isEqualTo(5);
        assertThat(TierPolicy.maxSets(Tier.LOTTO_GOD)).isEqualTo(10);
    }

    @Test
    void onlyLottoGodHasAdjustableSets() {
        assertThat(TierPolicy.hasAdjustableSets(Tier.BEGINNER)).isFalse();
        assertThat(TierPolicy.hasAdjustableSets(Tier.APPRENTICE)).isFalse();
        assertThat(TierPolicy.hasAdjustableSets(Tier.EXPERT)).isFalse();
        assertThat(TierPolicy.hasAdjustableSets(Tier.LOTTO_GOD)).isTrue();
    }

    @Test
    void computesPointsNeededForNextTier() {
        assertThat(TierPolicy.pointsToNextTier(Tier.BEGINNER, 0)).isEqualTo(50);
        assertThat(TierPolicy.pointsToNextTier(Tier.BEGINNER, 40)).isEqualTo(10);
        assertThat(TierPolicy.pointsToNextTier(Tier.APPRENTICE, 50)).isEqualTo(100);
    }

    @Test
    void returnsNullForPointsToNextTierAtExpertOrLottoGod() {
        assertThat(TierPolicy.pointsToNextTier(Tier.EXPERT, 150)).isNull();
        assertThat(TierPolicy.pointsToNextTier(Tier.EXPERT, 9999)).isNull();
        assertThat(TierPolicy.pointsToNextTier(Tier.LOTTO_GOD, 0)).isNull();
    }

    @Test
    void effectiveTierFallsBackToPointsWhenNotForced() {
        assertThat(TierPolicy.effectiveTier(null, 0)).isEqualTo(Tier.BEGINNER);
        assertThat(TierPolicy.effectiveTier(null, 150)).isEqualTo(Tier.EXPERT);
    }

    @Test
    void effectiveTierUsesTheForcedTierRegardlessOfPoints() {
        assertThat(TierPolicy.effectiveTier("LOTTO_GOD", 0)).isEqualTo(Tier.LOTTO_GOD);
        assertThat(TierPolicy.effectiveTier("BEGINNER", 10_000)).isEqualTo(Tier.BEGINNER);
    }

    @Test
    void tierFloorMatchesEachTiersStartingPointThreshold() {
        assertThat(TierPolicy.tierFloor(Tier.BEGINNER)).isEqualTo(0);
        assertThat(TierPolicy.tierFloor(Tier.APPRENTICE)).isEqualTo(50);
        assertThat(TierPolicy.tierFloor(Tier.EXPERT)).isEqualTo(150);
        assertThat(TierPolicy.tierFloor(Tier.LOTTO_GOD)).isEqualTo(150);
    }

    @Test
    void pensionIsCappedAtOnePerDayForEveryTierIncludingLottoGod() {
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.PENSION)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.APPRENTICE, Feature.PENSION)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.EXPERT, Feature.PENSION)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.PENSION)).isEqualTo(1);
    }
}
