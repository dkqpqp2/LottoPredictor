package com.lottopredictor.backend.crawler;

import java.time.LocalDate;

public final class DhLotteryResponseParser {

    private DhLotteryResponseParser() {
    }

    public static LottoDrawData parse(DhLotteryResponse response) {
        if (!"success".equals(response.returnValue())) {
            return null;
        }
        if (response.drwNo() == null
                || response.drwNoDate() == null
                || response.drwtNo1() == null
                || response.drwtNo2() == null
                || response.drwtNo3() == null
                || response.drwtNo4() == null
                || response.drwtNo5() == null
                || response.drwtNo6() == null
                || response.bnusNo() == null) {
            return null;
        }

        return new LottoDrawData(
                response.drwNo(),
                LocalDate.parse(response.drwNoDate()),
                response.drwtNo1(),
                response.drwtNo2(),
                response.drwtNo3(),
                response.drwtNo4(),
                response.drwtNo5(),
                response.drwtNo6(),
                response.bnusNo()
        );
    }
}
