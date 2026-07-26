package com.lottopredictor.backend.savednumber;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
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
        when(lottoDrawRepository.findById(1181)).thenReturn(Optional.empty());

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        SavedNumberResponse response = service.save(1L, "GENERATE", List.of(1, 2, 3, 4, 5, 6));

        assertThat(response.source()).isEqualTo("GENERATE");
        assertThat(response.targetDrawNo()).isEqualTo(1181);
        assertThat(response.numbers()).containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(response.resultAvailable()).isFalse();
    }

    @Test
    void saveDefaultsTheTargetDrawNoToOneWhenNoDrawsExistYet() {
        when(lottoDrawRepository.findMaxDrawNo()).thenReturn(Optional.empty());
        when(savedNumberRepository.save(any(SavedNumber.class))).thenAnswer(inv -> inv.getArgument(0));
        when(lottoDrawRepository.findById(1)).thenReturn(Optional.empty());

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        SavedNumberResponse response = service.save(1L, "TAROT", List.of(10, 20, 30, 40, 41, 45));

        assertThat(response.targetDrawNo()).isEqualTo(1);
    }

    @Test
    void getSavedReturnsAllSavedNumbersForTheUserMostRecentFirst() {
        SavedNumber existing = new SavedNumber(1L, "GENERATE", 1181, 1, 2, 3, 4, 5, 6, Instant.now());
        when(savedNumberRepository.findByUserIdOrderBySavedAtDesc(1L)).thenReturn(List.of(existing));
        when(lottoDrawRepository.findById(1181)).thenReturn(Optional.empty());

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        List<SavedNumberResponse> result = service.getSaved(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).source()).isEqualTo("GENERATE");
        assertThat(result.get(0).numbers()).containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(result.get(0).resultAvailable()).isFalse();
    }

    @Test
    void getSavedReportsMatchCountAndRankOnceTheTargetDrawIsResolved() {
        SavedNumber existing = new SavedNumber(1L, "GENERATE", 1230, 3, 8, 9, 22, 28, 1, Instant.now());
        when(savedNumberRepository.findByUserIdOrderBySavedAtDesc(1L)).thenReturn(List.of(existing));
        LottoDraw draw = new LottoDraw(1230, LocalDate.of(2026, 6, 27), 3, 8, 9, 22, 28, 42, 45);
        when(lottoDrawRepository.findById(1230)).thenReturn(Optional.of(draw));

        SavedNumberService service = new SavedNumberService(savedNumberRepository, lottoDrawRepository);
        List<SavedNumberResponse> result = service.getSaved(1L);

        SavedNumberResponse response = result.get(0);
        assertThat(response.resultAvailable()).isTrue();
        assertThat(response.matchCount()).isEqualTo(5);
        assertThat(response.bonusMatch()).isFalse();
        assertThat(response.rank()).isEqualTo("3등");
        assertThat(response.actualNumbers()).containsExactly(3, 8, 9, 22, 28, 42);
    }
}
