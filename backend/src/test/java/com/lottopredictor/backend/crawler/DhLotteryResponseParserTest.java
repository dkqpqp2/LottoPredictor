package com.lottopredictor.backend.crawler;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DhLotteryResponseParserTest {

    @Test
    void parsesTheMatchingEntryFromTheList() {
        DhLotteryResponse response = new DhLotteryResponse(new DhLotteryResponse.DhLotteryData(List.of(
                new DhLotteryDrawEntry(1050, "20230107", 1, 7, 13, 22, 31, 45, 10),
                new DhLotteryDrawEntry(1049, "20221231", 2, 3, 4, 5, 6, 7, 8)
        )));

        LottoDrawData draw = DhLotteryResponseParser.parse(response, 1050);

        assertThat(draw).isNotNull();
        assertThat(draw.drawNo()).isEqualTo(1050);
        assertThat(draw.drawDate()).isEqualTo(LocalDate.of(2023, 1, 7));
        assertThat(draw.num1()).isEqualTo(1);
        assertThat(draw.num6()).isEqualTo(45);
        assertThat(draw.bonusNum()).isEqualTo(10);
    }

    @Test
    void returnsNullWhenTheRequestedDrawIsNotInTheList() {
        DhLotteryResponse response = new DhLotteryResponse(new DhLotteryResponse.DhLotteryData(List.of(
                new DhLotteryDrawEntry(1049, "20221231", 2, 3, 4, 5, 6, 7, 8)
        )));

        assertThat(DhLotteryResponseParser.parse(response, 1050)).isNull();
    }

    @Test
    void returnsNullWhenTheListIsEmpty() {
        DhLotteryResponse response = new DhLotteryResponse(new DhLotteryResponse.DhLotteryData(List.of()));

        assertThat(DhLotteryResponseParser.parse(response, 1050)).isNull();
    }

    @Test
    void returnsNullWhenARequiredFieldIsMissing() {
        DhLotteryResponse response = new DhLotteryResponse(new DhLotteryResponse.DhLotteryData(List.of(
                new DhLotteryDrawEntry(1050, null, 1, 7, 13, 22, 31, 45, 10)
        )));

        assertThat(DhLotteryResponseParser.parse(response, 1050)).isNull();
    }
}
