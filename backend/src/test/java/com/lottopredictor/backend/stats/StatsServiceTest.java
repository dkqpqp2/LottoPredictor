package com.lottopredictor.backend.stats;

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
class StatsServiceTest {

    @Mock
    private LottoDrawRepository repository;

    @Test
    void findsDrawsThatShareTheExactSameSixNumberCombinationRegardlessOfOrder() {
        LottoDraw duplicateLater = new LottoDraw(900, LocalDate.of(2023, 5, 6), 42, 28, 22, 9, 8, 3, 15);
        LottoDraw duplicateEarlier = new LottoDraw(500, LocalDate.of(2020, 1, 4), 3, 8, 9, 22, 28, 42, 10);
        LottoDraw unique = new LottoDraw(600, LocalDate.of(2021, 3, 20), 1, 2, 3, 4, 5, 6, 7);
        when(repository.findAll()).thenReturn(List.of(duplicateLater, duplicateEarlier, unique));

        StatsService service = new StatsService(repository);
        List<DuplicateDrawGroup> result = service.findDuplicateCombinations();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).numbers()).containsExactly(3, 8, 9, 22, 28, 42);
        assertThat(result.get(0).drawNos()).containsExactly(500, 900);
    }

    @Test
    void returnsAnEmptyListWhenNoDuplicateCombinationsExist() {
        LottoDraw a = new LottoDraw(1, LocalDate.of(2020, 1, 4), 1, 2, 3, 4, 5, 6, 7);
        LottoDraw b = new LottoDraw(2, LocalDate.of(2020, 1, 11), 7, 8, 9, 10, 11, 12, 13);
        when(repository.findAll()).thenReturn(List.of(a, b));

        StatsService service = new StatsService(repository);
        List<DuplicateDrawGroup> result = service.findDuplicateCombinations();

        assertThat(result).isEmpty();
    }
}
