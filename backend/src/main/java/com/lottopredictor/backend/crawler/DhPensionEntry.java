package com.lottopredictor.backend.crawler;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DhPensionEntry(
        Integer psltEpsd,
        String psltRflYmd,
        String wnBndNo,
        String wnRnkVl,
        String bnsRnkVl
) {
}
