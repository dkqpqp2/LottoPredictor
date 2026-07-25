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
    void tarotIsCappedAtOnePerDayForEveryReachableTier() {
        assertThat(TierPolicy.dailyLimit(Tier.BEGINNER, Feature.TAROT)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.APPRENTICE, Feature.TAROT)).isEqualTo(1);
        assertThat(TierPolicy.dailyLimit(Tier.EXPERT, Feature.TAROT)).isEqualTo(1);
    }

    @Test
    void lottoGodHasEffectivelyUnlimitedUses() {
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.TAROT)).isEqualTo(Integer.MAX_VALUE);
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.GENERATE)).isEqualTo(Integer.MAX_VALUE);
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
        assertThat(TierPolicy.pointsToNextTier(0)).isEqualTo(50);
        assertThat(TierPolicy.pointsToNextTier(40)).isEqualTo(10);
        assertThat(TierPolicy.pointsToNextTier(50)).isEqualTo(100);
    }

    @Test
    void returnsNullForPointsToNextTierAtExpert() {
        assertThat(TierPolicy.pointsToNextTier(150)).isNull();
        assertThat(TierPolicy.pointsToNextTier(9999)).isNull();
    }
}
