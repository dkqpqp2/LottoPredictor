package com.lottopredictor.backend.crawler;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class DhLotteryResponseParserTest {

    @Test
    void parsesASuccessfulResponseIntoLottoDrawData() {
        DhLotteryResponse response = new DhLotteryResponse(
                "success", 1050, "2023-01-07", 1, 7, 13, 22, 31, 45, 10
        );

        LottoDrawData draw = DhLotteryResponseParser.parse(response);

        assertThat(draw).isNotNull();
        assertThat(draw.drawNo()).isEqualTo(1050);
        assertThat(draw.drawDate()).isEqualTo(LocalDate.of(2023, 1, 7));
        assertThat(draw.num1()).isEqualTo(1);
        assertThat(draw.num6()).isEqualTo(45);
        assertThat(draw.bonusNum()).isEqualTo(10);
    }

    @Test
    void returnsNullWhenReturnValueIsFail() {
        DhLotteryResponse response = new DhLotteryResponse(
                "fail", null, null, null, null, null, null, null, null, null
        );

        assertThat(DhLotteryResponseParser.parse(response)).isNull();
    }

    @Test
    void returnsNullWhenARequiredFieldIsMissing() {
        DhLotteryResponse response = new DhLotteryResponse(
                "success", 1050, null, null, null, null, null, null, null, null
        );

        assertThat(DhLotteryResponseParser.parse(response)).isNull();
    }
}
