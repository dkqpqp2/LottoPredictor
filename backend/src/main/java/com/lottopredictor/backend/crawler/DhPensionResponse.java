package com.lottopredictor.backend.crawler;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DhPensionResponse(DhPensionData data) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DhPensionData(List<DhPensionEntry> result) {
    }
}
