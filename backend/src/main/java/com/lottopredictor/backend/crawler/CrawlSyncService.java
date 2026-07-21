package com.lottopredictor.backend.crawler;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.IntFunction;
import java.util.function.IntSupplier;

public final class CrawlSyncService {

    private static final int DEFAULT_MAX_ATTEMPTS = 200;

    private CrawlSyncService() {
    }

    public static SyncResult sync(
            IntSupplier getLatestDrawNo,
            IntFunction<FetchDrawResult> fetchDraw,
            Consumer<LottoDrawData> upsertDraw
    ) {
        return sync(getLatestDrawNo, fetchDraw, upsertDraw, DEFAULT_MAX_ATTEMPTS);
    }

    public static SyncResult sync(
            IntSupplier getLatestDrawNo,
            IntFunction<FetchDrawResult> fetchDraw,
            Consumer<LottoDrawData> upsertDraw,
            int maxAttempts
    ) {
        int latest = getLatestDrawNo.getAsInt();
        List<Integer> synced = new ArrayList<>();
        List<SkippedDraw> skipped = new ArrayList<>();

        int drawNo = latest + 1;
        int attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;
            FetchDrawResult result = fetchDraw.apply(drawNo);

            if (result instanceof FetchDrawResult.NotDrawnYet) {
                break;
            }

            if (result instanceof FetchDrawResult.Error error) {
                skipped.add(new SkippedDraw(drawNo, error.message()));
                drawNo++;
                continue;
            }

            FetchDrawResult.Success success = (FetchDrawResult.Success) result;
            upsertDraw.accept(success.draw());
            synced.add(drawNo);
            drawNo++;
        }

        return new SyncResult(synced, skipped);
    }
}
