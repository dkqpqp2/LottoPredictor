package com.lottopredictor.backend.progress;

public record ProgressResponse(
        String tier,
        int totalPoints,
        Integer pointsToNextTier,
        UsageInfo tarotUsage,
        UsageInfo generateUsage,
        int maxSets,
        boolean adjustableSets,
        int tierFloor
) {
    public record UsageInfo(int used, int limit) {
    }
}
