package com.lottopredictor.backend.crawler;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DhLotteryResponse(DhLotteryData data) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DhLotteryData(List<DhLotteryDrawEntry> list) {
    }
}
