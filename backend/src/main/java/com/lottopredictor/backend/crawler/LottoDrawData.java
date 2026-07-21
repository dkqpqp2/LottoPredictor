package com.lottopredictor.backend.crawler;

import java.time.LocalDate;

public record LottoDrawData(
        int drawNo,
        LocalDate drawDate,
        int num1,
        int num2,
        int num3,
        int num4,
        int num5,
        int num6,
        int bonusNum
) {
}
