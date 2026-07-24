package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.generate.GenerateResult;
import com.lottopredictor.backend.generate.NumberGenerationService;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GenerateController {

    private final NumberGenerationService service;
    private final UsageService usageService;

    public GenerateController(NumberGenerationService service, UsageService usageService) {
        this.service = service;
        this.usageService = usageService;
    }

    @GetMapping("/api/generate")
    public ResponseEntity<GenerateResult> generate(
            @RequestParam(defaultValue = "weighted") String mode,
            @RequestParam(defaultValue = "1") int sets,
            @AuthPrincipal AuthenticatedUser principal
    ) {
        if (!usageService.consume(principal.userId(), Feature.GENERATE)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        int clampedSets = Math.min(Math.max(sets, 1), 10);
        String normalizedMode = "random".equals(mode) ? "random" : "weighted";
        return ResponseEntity.ok(service.generate(normalizedMode, clampedSets));
    }
}
