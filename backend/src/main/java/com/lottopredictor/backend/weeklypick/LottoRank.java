package com.lottopredictor.backend.weeklypick;

public final class LottoRank {

    private LottoRank() {
    }

    public static String forMatch(int matchCount, boolean bonusMatch) {
        if (matchCount == 6) {
            return "1등";
        }
        if (matchCount == 5 && bonusMatch) {
            return "2등";
        }
        if (matchCount == 5) {
            return "3등";
        }
        if (matchCount == 4) {
            return "4등";
        }
        if (matchCount == 3) {
            return "5등";
        }
        return null;
    }
}
