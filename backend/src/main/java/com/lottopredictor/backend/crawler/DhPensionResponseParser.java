package com.lottopredictor.backend.crawler;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public final class DhPensionResponseParser {

    private DhPensionResponseParser() {
    }

    public static List<PensionDrawData> parse(DhPensionResponse response) {
        List<PensionDrawData> result = new ArrayList<>();
        if (response.data() == null || response.data().result() == null) {
            return result;
        }

        for (DhPensionEntry entry : response.data().result()) {
            PensionDrawData data = parseEntry(entry);
            if (data != null) {
                result.add(data);
            }
        }
        return result;
    }

    private static PensionDrawData parseEntry(DhPensionEntry entry) {
        if (entry.psltEpsd() == null
                || entry.psltRflYmd() == null
                || entry.wnBndNo() == null
                || entry.wnRnkVl() == null
                || entry.bnsRnkVl() == null) {
            return null;
        }

        try {
            return new PensionDrawData(
                    entry.psltEpsd(),
                    LocalDate.parse(entry.psltRflYmd(), DateTimeFormatter.BASIC_ISO_DATE),
                    Integer.parseInt(entry.wnBndNo()),
                    entry.wnRnkVl(),
                    entry.bnsRnkVl()
            );
        } catch (RuntimeException e) {
            return null;
        }
    }
}
