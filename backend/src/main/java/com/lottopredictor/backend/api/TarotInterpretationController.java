package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.tarotinterpretation.TarotInterpretationFailedException;
import com.lottopredictor.backend.tarotinterpretation.TarotInterpretationRequest;
import com.lottopredictor.backend.tarotinterpretation.TarotInterpretationResponse;
import com.lottopredictor.backend.tarotinterpretation.TarotInterpretationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class TarotInterpretationController {

    private final TarotInterpretationService service;

    public TarotInterpretationController(TarotInterpretationService service) {
        this.service = service;
    }

    @PostMapping("/api/tarot/interpretation")
    public ResponseEntity<TarotInterpretationResponse> interpret(
            @RequestBody TarotInterpretationRequest request,
            @AuthPrincipal AuthenticatedUser principal
    ) {
        try {
            return service.interpret(principal.userId(), request)
                    .map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build());
        } catch (TarotInterpretationFailedException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }

    @GetMapping("/api/tarot/interpretations")
    public List<TarotInterpretationResponse> history(@AuthPrincipal AuthenticatedUser principal) {
        return service.getHistory(principal.userId());
    }
}
