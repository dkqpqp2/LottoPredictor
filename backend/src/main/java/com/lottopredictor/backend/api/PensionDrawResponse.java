package com.lottopredictor.backend.api;

import com.lottopredictor.backend.pensiondraw.PensionDraw;

import java.time.LocalDate;

public record PensionDrawResponse(
        int drawNo,
        LocalDate drawDate,
        int groupNo,
        String number,
        String bonusNumber
) {
    public static PensionDrawResponse from(PensionDraw draw) {
        return new PensionDrawResponse(
                draw.getDrawNo(), draw.getDrawDate(), draw.getGroupNo(), draw.getNumber(), draw.getBonusNumber()
        );
    }
}
