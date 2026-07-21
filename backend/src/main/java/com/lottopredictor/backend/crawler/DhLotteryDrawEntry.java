package com.lottopredictor.backend.crawler;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DhLotteryDrawEntry(
        Integer ltEpsd,
        String ltRflYmd,
        Integer tm1WnNo,
        Integer tm2WnNo,
        Integer tm3WnNo,
        Integer tm4WnNo,
        Integer tm5WnNo,
        Integer tm6WnNo,
        Integer bnsWnNo
) {
}
