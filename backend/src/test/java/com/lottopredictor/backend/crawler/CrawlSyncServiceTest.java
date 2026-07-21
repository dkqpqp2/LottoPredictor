package com.lottopredictor.backend.crawler;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.function.IntFunction;

import static org.assertj.core.api.Assertions.assertThat;

class CrawlSyncServiceTest {

    private static LottoDrawData draw(int drawNo) {
        return new LottoDrawData(drawNo, LocalDate.of(2023, 1, 7), 1, 2, 3, 4, 5, 6, 7);
    }

    @Test
    void fetchesSequentiallyFromLatestPlusOneUntilNotDrawnYetThenStops() {
        IntFunction<FetchDrawResult> fetchDraw = drawNo ->
                drawNo <= 1052
                        ? new FetchDrawResult.Success(draw(drawNo))
                        : new FetchDrawResult.NotDrawnYet();
        List<LottoDrawData> upserted = new ArrayList<>();

        SyncResult result = CrawlSyncService.sync(() -> 1050, fetchDraw, upserted::add);

        assertThat(result.synced()).containsExactly(1051, 1052);
        assertThat(result.skipped()).isEmpty();
        assertThat(upserted).hasSize(2);
    }

    @Test
    void logsASkipAndContinuesPastADrawThatErrors() {
        IntFunction<FetchDrawResult> fetchDraw = drawNo -> {
            if (drawNo == 1051) return new FetchDrawResult.Error("network blip");
            if (drawNo == 1052) return new FetchDrawResult.Success(draw(drawNo));
            return new FetchDrawResult.NotDrawnYet();
        };
        List<LottoDrawData> upserted = new ArrayList<>();

        SyncResult result = CrawlSyncService.sync(() -> 1050, fetchDraw, upserted::add);

        assertThat(result.synced()).containsExactly(1052);
        assertThat(result.skipped()).containsExactly(new SkippedDraw(1051, "network blip"));
    }

    @Test
    void stopsAfterMaxAttemptsToAvoidAnUnboundedLoop() {
        IntFunction<FetchDrawResult> fetchDraw = drawNo -> new FetchDrawResult.Error("always fails");
        List<LottoDrawData> upserted = new ArrayList<>();

        SyncResult result = CrawlSyncService.sync(() -> 0, fetchDraw, upserted::add, 5);

        assertThat(result.skipped()).hasSize(5);
    }
}
