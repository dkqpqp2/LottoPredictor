package com.lottopredictor.backend.savednumber;

import com.lottopredictor.backend.draw.LottoDrawRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SavedNumberServiceTest {

    @Mock
    private SavedNumberRepository savedNumberRepository;

    @Mock
    private LottoDrawRepository lottoDrawRepository;

    @Test
    void saveComputesTheNextDrawNoAndPersistsTheNumbers() {
        when(lottoDrawRepository.findMaxDrawNo()).thenReturn(Optional.of(1180));
        when(savedNumberRepository.save(any(SavedNumber.class))).thenAnswer(inv -> inv.getArgument(0));

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        SavedNumberResponse response = service.save(1L, "GENERATE", List.of(1, 2, 3, 4, 5, 6));

        assertThat(response.source()).isEqualTo("GENERATE");
        assertThat(response.targetDrawNo()).isEqualTo(1181);
        assertThat(response.numbers()).containsExactly(1, 2, 3, 4, 5, 6);
    }

    @Test
    void saveDefaultsTheTargetDrawNoToOneWhenNoDrawsExistYet() {
        when(lottoDrawRepository.findMaxDrawNo()).thenReturn(Optional.empty());
        when(savedNumberRepository.save(any(SavedNumber.class))).thenAnswer(inv -> inv.getArgument(0));

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        SavedNumberResponse response = service.save(1L, "TAROT", List.of(10, 20, 30, 40, 41, 45));

        assertThat(response.targetDrawNo()).isEqualTo(1);
    }

    @Test
    void getSavedReturnsAllSavedNumbersForTheUserMostRecentFirst() {
        SavedNumber existing = new SavedNumber(1L, "GENERATE", 1181, 1, 2, 3, 4, 5, 6, Instant.now());
        when(savedNumberRepository.findByUserIdOrderBySavedAtDesc(1L)).thenReturn(List.of(existing));

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        List<SavedNumberResponse> result = service.getSaved(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).source()).isEqualTo("GENERATE");
        assertThat(result.get(0).numbers()).containsExactly(1, 2, 3, 4, 5, 6);
    }
}
