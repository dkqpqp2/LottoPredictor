package com.lottopredictor.backend.tarotinterpretation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.UsageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TarotInterpretationServiceTest {

    @Mock
    private TarotInterpretationRepository repository;

    @Mock
    private UsageService usageService;

    @Mock
    private ClaudeTarotInterpreter interpreter;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private TarotInterpretationRequest sampleRequest() {
        return new TarotInterpretationRequest(
                "WITH_ZODIAC",
                List.of(new TarotInterpretationRequest.CardInput(0, "바보", "새로운 시작", "up", null)),
                "물병자리"
        );
    }

    @Test
    void interpretReturnsEmptyWithoutCallingClaudeWhenQuotaIsExhausted() {
        when(usageService.consume(1L, Feature.TAROT)).thenReturn(false);

        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);
        Optional<TarotInterpretationResponse> result = service.interpret(1L, sampleRequest());

        assertThat(result).isEmpty();
        verifyNoInteractions(interpreter);
        verifyNoInteractions(repository);
    }

    @Test
    void interpretSavesAndReturnsTheGeneratedTextWhenQuotaAllows() {
        when(usageService.consume(1L, Feature.TAROT)).thenReturn(true);
        when(interpreter.interpret(anyString())).thenReturn("따뜻한 해석 텍스트");
        when(repository.save(any(TarotInterpretation.class))).thenAnswer(inv -> inv.getArgument(0));

        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);
        Optional<TarotInterpretationResponse> result = service.interpret(1L, sampleRequest());

        assertThat(result).isPresent();
        assertThat(result.get().interpretationText()).isEqualTo("따뜻한 해석 텍스트");
        assertThat(result.get().mode()).isEqualTo("WITH_ZODIAC");
        assertThat(result.get().zodiacName()).isEqualTo("물병자리");
        assertThat(result.get().cards()).hasSize(1);
        assertThat(result.get().cards().get(0).nameKo()).isEqualTo("바보");
    }

    @Test
    void interpretPropagatesTheFailureWithoutSavingWhenClaudeCallFails() {
        when(usageService.consume(1L, Feature.TAROT)).thenReturn(true);
        when(interpreter.interpret(anyString())).thenThrow(new TarotInterpretationFailedException("boom", null));

        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);

        assertThatThrownBy(() -> service.interpret(1L, sampleRequest()))
                .isInstanceOf(TarotInterpretationFailedException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void interpretRejectsInvalidModeWithoutConsumingQuotaOrCallingClaude() {
        TarotInterpretationRequest request = new TarotInterpretationRequest(
                "BOGUS_MODE",
                List.of(new TarotInterpretationRequest.CardInput(0, "바보", "새로운 시작", "up", null)),
                "물병자리"
        );
        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);

        assertThatThrownBy(() -> service.interpret(1L, request))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));

        verifyNoInteractions(usageService);
        verifyNoInteractions(interpreter);
    }

    @Test
    void interpretRejectsEmptyCardsWithoutConsumingQuotaOrCallingClaude() {
        TarotInterpretationRequest request = new TarotInterpretationRequest("WITH_ZODIAC", List.of(), "물병자리");
        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);

        assertThatThrownBy(() -> service.interpret(1L, request))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));

        verifyNoInteractions(usageService);
        verifyNoInteractions(interpreter);
    }

    @Test
    void interpretRejectsInvalidDirectionWithoutConsumingQuotaOrCallingClaude() {
        TarotInterpretationRequest request = new TarotInterpretationRequest(
                "WITH_ZODIAC",
                List.of(new TarotInterpretationRequest.CardInput(0, "바보", "새로운 시작", "sideways", null)),
                "물병자리"
        );
        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);

        assertThatThrownBy(() -> service.interpret(1L, request))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));

        verifyNoInteractions(usageService);
        verifyNoInteractions(interpreter);
    }

    @Test
    void interpretRejectsOversizedZodiacNameWithoutConsumingQuotaOrCallingClaude() {
        TarotInterpretationRequest request = new TarotInterpretationRequest(
                "WITH_ZODIAC",
                List.of(new TarotInterpretationRequest.CardInput(0, "바보", "새로운 시작", "up", null)),
                "가".repeat(21)
        );
        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);

        assertThatThrownBy(() -> service.interpret(1L, request))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));

        verifyNoInteractions(usageService);
        verifyNoInteractions(interpreter);
    }

    @Test
    void getHistoryReturnsPastInterpretationsMostRecentFirst() {
        String cardsJson =
                "[{\"cardNumber\":0,\"nameKo\":\"바보\",\"keyword\":\"새로운 시작\",\"direction\":\"up\",\"positionLabel\":null}]";
        TarotInterpretation entity =
                new TarotInterpretation(1L, "WITH_ZODIAC", cardsJson, "물병자리", "해석문", Instant.now());
        when(repository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(entity));

        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);
        List<TarotInterpretationResponse> history = service.getHistory(1L);

        assertThat(history).hasSize(1);
        assertThat(history.get(0).interpretationText()).isEqualTo("해석문");
        assertThat(history.get(0).cards().get(0).nameKo()).isEqualTo("바보");
    }
}
