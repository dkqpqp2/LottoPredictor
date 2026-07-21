package com.lottopredictor.backend.crawler;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

public final class DhLotteryResponseParser {

    private DhLotteryResponseParser() {
    }

    public static LottoDrawData parse(DhLotteryResponse response, int requestedDrawNo) {
        if (response.data() == null || response.data().list() == null) {
            return null;
        }

        DhLotteryDrawEntry entry = response.data().list().stream()
                .filter(e -> e.ltEpsd() != null && e.ltEpsd() == requestedDrawNo)
                .findFirst()
                .orElse(null);

        if (entry == null) {
            return null;
        }

        if (entry.ltRflYmd() == null
                || entry.tm1WnNo() == null
                || entry.tm2WnNo() == null
                || entry.tm3WnNo() == null
                || entry.tm4WnNo() == null
                || entry.tm5WnNo() == null
                || entry.tm6WnNo() == null
                || entry.bnsWnNo() == null) {
            return null;
        }

        return new LottoDrawData(
                entry.ltEpsd(),
                LocalDate.parse(entry.ltRflYmd(), DateTimeFormatter.BASIC_ISO_DATE),
                entry.tm1WnNo(),
                entry.tm2WnNo(),
                entry.tm3WnNo(),
                entry.tm4WnNo(),
                entry.tm5WnNo(),
                entry.tm6WnNo(),
                entry.bnsWnNo()
        );
    }
}
