package com.lottopredictor.backend.admin;

import java.time.Instant;

public record AdminUserResponse(
        Long id,
        String nickname,
        String tier,
        int totalPoints,
        String forcedTier,
        Instant joinedAt
) {
}
