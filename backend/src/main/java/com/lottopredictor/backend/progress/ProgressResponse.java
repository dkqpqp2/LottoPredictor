package com.lottopredictor.backend.progress;

public record ProgressResponse(
        String tier,
        int totalPoints,
        Integer pointsToNextTier,
        UsageInfo tarotUsage,
        UsageInfo generateUsage,
        UsageInfo pensionUsage,
        int maxSets,
        boolean adjustableSets,
        int tierFloor
) {
    public record UsageInfo(int used, int limit) {
    }
}
