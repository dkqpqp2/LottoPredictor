package com.lottopredictor.backend.weeklypick;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LottoRankTest {

    @Test
    void sixMatchesIsFirstPlace() {
        assertThat(LottoRank.forMatch(6, false)).isEqualTo("1등");
        assertThat(LottoRank.forMatch(6, true)).isEqualTo("1등");
    }

    @Test
    void fiveMatchesWithBonusIsSecondPlace() {
        assertThat(LottoRank.forMatch(5, true)).isEqualTo("2등");
    }

    @Test
    void fiveMatchesWithoutBonusIsThirdPlace() {
        assertThat(LottoRank.forMatch(5, false)).isEqualTo("3등");
    }

    @Test
    void fourMatchesIsFourthPlace() {
        assertThat(LottoRank.forMatch(4, false)).isEqualTo("4등");
        assertThat(LottoRank.forMatch(4, true)).isEqualTo("4등");
    }

    @Test
    void threeMatchesIsFifthPlace() {
        assertThat(LottoRank.forMatch(3, false)).isEqualTo("5등");
    }

    @Test
    void fewerThanThreeMatchesHasNoRank() {
        assertThat(LottoRank.forMatch(2, true)).isNull();
        assertThat(LottoRank.forMatch(0, false)).isNull();
    }
}
