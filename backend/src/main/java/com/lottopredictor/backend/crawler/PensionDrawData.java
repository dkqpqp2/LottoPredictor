package com.lottopredictor.backend.crawler;

import java.time.LocalDate;

public record PensionDrawData(
        int drawNo,
        LocalDate drawDate,
        int groupNo,
        String number,
        String bonusNumber
) {
}
