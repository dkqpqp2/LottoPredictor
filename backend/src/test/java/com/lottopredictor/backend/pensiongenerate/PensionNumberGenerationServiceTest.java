package com.lottopredictor.backend.pensiongenerate;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PensionNumberGenerationServiceTest {

    @Test
    void generatesAGroupNumberBetweenOneAndFive() {
        PensionNumberGenerationService service = new PensionNumberGenerationService();
        for (int i = 0; i < 50; i++) {
            PensionGenerateResult result = service.generate();
            assertThat(result.groupNo()).isBetween(1, 5);
        }
    }

    @Test
    void generatesASixDigitZeroPaddedNumber() {
        PensionNumberGenerationService service = new PensionNumberGenerationService();
        for (int i = 0; i < 50; i++) {
            PensionGenerateResult result = service.generate();
            assertThat(result.number()).hasSize(6);
            assertThat(result.number()).matches("\\d{6}");
        }
    }

    @Test
    void isDeterministicAtTheLowerBoundaryGivenAFixedRng() {
        PensionNumberGenerationService service = new PensionNumberGenerationService();

        PensionGenerateResult result = service.generate(() -> 0.0);

        assertThat(result.groupNo()).isEqualTo(1);
        assertThat(result.number()).isEqualTo("000000");
    }

    @Test
    void isDeterministicAtTheUpperBoundaryGivenAFixedRng() {
        PensionNumberGenerationService service = new PensionNumberGenerationService();

        PensionGenerateResult result = service.generate(() -> 0.999999);

        assertThat(result.groupNo()).isEqualTo(5);
        assertThat(result.number()).isEqualTo("999999");
    }
}
