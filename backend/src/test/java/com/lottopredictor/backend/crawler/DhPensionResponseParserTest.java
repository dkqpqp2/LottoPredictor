package com.lottopredictor.backend.crawler;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DhPensionResponseParserTest {

    @Test
    void parsesAllEntriesInTheList() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(List.of(
                new DhPensionEntry(325, "20260723", "3", "011391", "438906"),
                new DhPensionEntry(324, "20260716", "2", "485216", "061918")
        )));

        List<PensionDrawData> draws = DhPensionResponseParser.parse(response);

        assertThat(draws).hasSize(2);
        PensionDrawData first = draws.get(0);
        assertThat(first.drawNo()).isEqualTo(325);
        assertThat(first.drawDate()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(first.groupNo()).isEqualTo(3);
        assertThat(first.number()).isEqualTo("011391");
        assertThat(first.bonusNumber()).isEqualTo("438906");
    }

    @Test
    void preservesLeadingZerosInTheNumberFields() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(List.of(
                new DhPensionEntry(1, "20200102", "1", "000001", "000002")
        )));

        List<PensionDrawData> draws = DhPensionResponseParser.parse(response);

        assertThat(draws.get(0).number()).isEqualTo("000001");
        assertThat(draws.get(0).bonusNumber()).isEqualTo("000002");
    }

    @Test
    void skipsEntriesWithAMissingField() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(List.of(
                new DhPensionEntry(325, null, "3", "011391", "438906"),
                new DhPensionEntry(324, "20260716", "2", "485216", "061918")
        )));

        List<PensionDrawData> draws = DhPensionResponseParser.parse(response);

        assertThat(draws).hasSize(1);
        assertThat(draws.get(0).drawNo()).isEqualTo(324);
    }

    @Test
    void returnsEmptyListWhenDataIsNull() {
        DhPensionResponse response = new DhPensionResponse(null);

        assertThat(DhPensionResponseParser.parse(response)).isEmpty();
    }

    @Test
    void returnsEmptyListWhenResultIsNull() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(null));

        assertThat(DhPensionResponseParser.parse(response)).isEmpty();
    }

    @Test
    void skipsEntriesWithAMalformedField() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(List.of(
                new DhPensionEntry(325, "not-a-date", "3", "011391", "438906"),
                new DhPensionEntry(324, "20260716", "2", "485216", "061918")
        )));

        List<PensionDrawData> draws = DhPensionResponseParser.parse(response);

        assertThat(draws).hasSize(1);
        assertThat(draws.get(0).drawNo()).isEqualTo(324);
    }
}
