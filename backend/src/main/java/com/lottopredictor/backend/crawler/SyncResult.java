package com.lottopredictor.backend.crawler;

import java.util.List;

public record SyncResult(List<Integer> synced, List<SkippedDraw> skipped) {
}
