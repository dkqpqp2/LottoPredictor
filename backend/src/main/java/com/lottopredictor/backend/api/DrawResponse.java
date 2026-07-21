package com.lottopredictor.backend.api;

import com.lottopredictor.backend.draw.LottoDraw;

import java.time.LocalDate;
import java.util.List;

public record DrawResponse(
        int drawNo,
        LocalDate drawDate,
        List<Integer> numbers,
        int bonusNum
) {
    public static DrawResponse from(LottoDraw draw) {
        return new DrawResponse(
                draw.getDrawNo(),
                draw.getDrawDate(),
                List.of(draw.getNum1(), draw.getNum2(), draw.getNum3(), draw.getNum4(), draw.getNum5(), draw.getNum6()),
                draw.getBonusNum()
        );
    }
}
