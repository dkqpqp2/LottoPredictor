package com.lottopredictor.backend.crawler;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PensionCrawlerServiceTest {

    @Mock
    private PensionDrawRepository repository;

    @Mock
    private DhPensionClient client;

    @Test
    void savesOnlyDrawsNewerThanTheCurrentMax() {
        when(repository.findMaxDrawNo()).thenReturn(Optional.of(323));
        when(client.fetchAll()).thenReturn(List.of(
                new PensionDrawData(325, LocalDate.of(2026, 7, 23), 3, "011391", "438906"),
                new PensionDrawData(324, LocalDate.of(2026, 7, 16), 2, "485216", "061918"),
                new PensionDrawData(323, LocalDate.of(2026, 7, 9), 4, "604270", "945893")
        ));

        PensionCrawlerService service = new PensionCrawlerService(repository, client);
        SyncResult result = service.syncLatestDraws();

        assertThat(result.synced()).containsExactlyInAnyOrder(324, 325);
        assertThat(result.skipped()).isEmpty();
        verify(repository, times(2)).save(any(PensionDraw.class));
    }

    @Test
    void savesNothingWhenAllDrawsAreAlreadyStored() {
        when(repository.findMaxDrawNo()).thenReturn(Optional.of(325));
        when(client.fetchAll()).thenReturn(List.of(
                new PensionDrawData(325, LocalDate.of(2026, 7, 23), 3, "011391", "438906")
        ));

        PensionCrawlerService service = new PensionCrawlerService(repository, client);
        SyncResult result = service.syncLatestDraws();

        assertThat(result.synced()).isEmpty();
        verify(repository, never()).save(any());
    }

    @Test
    void savesEverythingWhenNoDrawsAreStoredYet() {
        when(repository.findMaxDrawNo()).thenReturn(Optional.empty());
        when(client.fetchAll()).thenReturn(List.of(
                new PensionDrawData(2, LocalDate.of(2020, 1, 9), 1, "000002", "111111"),
                new PensionDrawData(1, LocalDate.of(2020, 1, 2), 5, "000001", "222222")
        ));

        PensionCrawlerService service = new PensionCrawlerService(repository, client);
        SyncResult result = service.syncLatestDraws();

        assertThat(result.synced()).containsExactlyInAnyOrder(1, 2);
    }
}
