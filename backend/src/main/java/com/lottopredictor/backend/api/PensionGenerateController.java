package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.pensiongenerate.PensionGenerateResult;
import com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationService;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PensionGenerateController {

    private final PensionNumberGenerationService service;
    private final UsageService usageService;

    public PensionGenerateController(PensionNumberGenerationService service, UsageService usageService) {
        this.service = service;
        this.usageService = usageService;
    }

    @GetMapping("/api/pension/generate")
    public ResponseEntity<PensionGenerateResult> generate(@AuthPrincipal AuthenticatedUser principal) {
        if (!usageService.consume(principal.userId(), Feature.PENSION)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        return ResponseEntity.ok(service.generate());
    }
}
