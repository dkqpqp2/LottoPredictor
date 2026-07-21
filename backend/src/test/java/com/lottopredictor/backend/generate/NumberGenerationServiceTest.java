package com.lottopredictor.backend.generate;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NumberGenerationServiceTest {

    @Mock
    private LottoDrawRepository repository;

    @Test
    void fallsBackToRandomModeWhenThereAreNoDraws() {
        when(repository.findAll()).thenReturn(List.of());
        NumberGenerationService service = new NumberGenerationService(repository);

        GenerateResult result = service.generate("weighted", 1);

        assertThat(result.mode()).isEqualTo("random");
        assertThat(result.results()).hasSize(1);
        assertThat(result.results().get(0)).hasSize(6);
    }

    @Test
    void usesWeightedModeWhenDrawsExistAndWeightedIsRequested() {
        when(repository.findAll()).thenReturn(List.of(
                new LottoDraw(1, LocalDate.of(2023, 1, 7), 1, 2, 3, 4, 5, 6, 7)
        ));
        NumberGenerationService service = new NumberGenerationService(repository);

        GenerateResult result = service.generate("weighted", 1);

        assertThat(result.mode()).isEqualTo("weighted");
    }

    @Test
    void generatesTheRequestedNumberOfSetsEachSortedAscending() {
        when(repository.findAll()).thenReturn(List.of());
        NumberGenerationService service = new NumberGenerationService(repository);

        GenerateResult result = service.generate("random", 3);

        assertThat(result.results()).hasSize(3);
        result.results().forEach(set -> assertThat(set).isSorted());
    }
}
