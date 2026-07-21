package com.lottopredictor.backend.crawler;

public record DhLotteryResponse(
        String returnValue,
        Integer drwNo,
        String drwNoDate,
        Integer drwtNo1,
        Integer drwtNo2,
        Integer drwtNo3,
        Integer drwtNo4,
        Integer drwtNo5,
        Integer drwtNo6,
        Integer bnusNo
) {
}
