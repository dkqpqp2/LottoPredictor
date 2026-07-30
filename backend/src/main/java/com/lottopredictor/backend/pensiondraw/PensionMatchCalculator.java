package com.lottopredictor.backend.pensiondraw;

public final class PensionMatchCalculator {

    private PensionMatchCalculator() {
    }

    public record MatchResult(String rank, boolean bonusMatch) {
    }

    public static MatchResult calculate(int pickedGroupNo, String pickedNumber, PensionDraw draw) {
        int suffixLen = commonSuffixLength(pickedNumber, draw.getNumber());
        String rank;
        if (suffixLen == 6) {
            rank = pickedGroupNo == draw.getGroupNo() ? "1등" : "2등";
        } else {
            rank = switch (suffixLen) {
                case 5 -> "3등";
                case 4 -> "4등";
                case 3 -> "5등";
                case 2 -> "6등";
                case 1 -> "7등";
                default -> null;
            };
        }
        boolean bonusMatch = pickedNumber.equals(draw.getBonusNumber());
        return new MatchResult(rank, bonusMatch);
    }

    private static int commonSuffixLength(String a, String b) {
        int len = 0;
        for (int i = 1; i <= 6; i++) {
            if (a.charAt(6 - i) == b.charAt(6 - i)) {
                len++;
            } else {
                break;
            }
        }
        return len;
    }
}
