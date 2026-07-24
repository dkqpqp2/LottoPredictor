package com.lottopredictor.backend.savednumber;

import java.time.Instant;
import java.util.List;

public record SavedNumberResponse(Long id, String source, int targetDrawNo, List<Integer> numbers, Instant savedAt) {
}
