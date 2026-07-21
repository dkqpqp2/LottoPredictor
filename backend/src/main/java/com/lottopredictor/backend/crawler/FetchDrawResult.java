package com.lottopredictor.backend.crawler;

public sealed interface FetchDrawResult {

    record Success(LottoDrawData draw) implements FetchDrawResult {
    }

    record NotDrawnYet() implements FetchDrawResult {
    }

    record Error(String message) implements FetchDrawResult {
    }
}
