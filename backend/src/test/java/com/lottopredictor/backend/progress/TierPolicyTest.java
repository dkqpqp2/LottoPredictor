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
    void mapsOneHundredFiftyPointsToExpert() {
        assertThat(TierPolicy.tierForPoints(150)).isEqualTo(Tier.EXPERT);
        assertThat(TierPolicy.tierForPoints(349)).isEqualTo(Tier.EXPERT);
    }

    @Test
    void mapsThreeHundredFiftyPointsToMaster() {
        assertThat(TierPolicy.tierForPoints(350)).isEqualTo(Tier.MASTER);
        assertThat(TierPolicy.tierForPoints(10_000)).isEqualTo(Tier.MASTER);
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
    void masterHasFiveUsesPerFeaturePerDay() {
        assertThat(TierPolicy.dailyLimit(Tier.MASTER, Feature.TAROT)).isEqualTo(5);
        assertThat(TierPolicy.dailyLimit(Tier.MASTER, Feature.GENERATE)).isEqualTo(5);
    }

    @Test
    void lottoGodHasEffectivelyUnlimitedUses() {
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.TAROT)).isEqualTo(Integer.MAX_VALUE);
        assertThat(TierPolicy.dailyLimit(Tier.LOTTO_GOD, Feature.GENERATE)).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void computesPointsNeededForNextTier() {
        assertThat(TierPolicy.pointsToNextTier(0)).isEqualTo(50);
        assertThat(TierPolicy.pointsToNextTier(40)).isEqualTo(10);
        assertThat(TierPolicy.pointsToNextTier(150)).isEqualTo(200);
    }

    @Test
    void returnsNullForPointsToNextTierAtMaster() {
        assertThat(TierPolicy.pointsToNextTier(350)).isNull();
        assertThat(TierPolicy.pointsToNextTier(9999)).isNull();
    }
}
