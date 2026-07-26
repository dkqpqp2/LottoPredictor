package com.lottopredictor.backend.draw;

import com.lottopredictor.backend.weeklypick.LottoRank;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class LottoMatchCalculator {

    private LottoMatchCalculator() {
    }

    public record MatchResult(int matchCount, boolean bonusMatch, String rank) {
    }

    public static MatchResult calculate(List<Integer> picked, LottoDraw draw) {
        Set<Integer> actualMainSet = new HashSet<>();
        for (int n : draw.numbers()) {
            actualMainSet.add(n);
        }
        int matchCount = (int) picked.stream().filter(actualMainSet::contains).count();
        boolean bonusMatch = picked.contains(draw.getBonusNum());
        String rank = LottoRank.forMatch(matchCount, bonusMatch);
        return new MatchResult(matchCount, bonusMatch, rank);
    }
}
