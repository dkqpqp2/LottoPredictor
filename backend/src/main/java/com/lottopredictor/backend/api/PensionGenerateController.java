package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.pensiongenerate.PensionGenerateResult;
import com.lottopredictor.backend.pensiongenerate.PensionNumberGenerationService;
import com.lottopredictor.backend.pensionsavednumber.PensionSavedNumberService;
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
    private final PensionSavedNumberService pensionSavedNumberService;

    public PensionGenerateController(
            PensionNumberGenerationService service,
            UsageService usageService,
            PensionSavedNumberService pensionSavedNumberService
    ) {
        this.service = service;
        this.usageService = usageService;
        this.pensionSavedNumberService = pensionSavedNumberService;
    }

    @GetMapping("/api/pension/generate")
    public ResponseEntity<PensionGenerateResult> generate(@AuthPrincipal AuthenticatedUser principal) {
        if (!usageService.consume(principal.userId(), Feature.PENSION)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        PensionGenerateResult result = service.generate();
        pensionSavedNumberService.save(principal.userId(), result.groupNo(), result.number());
        return ResponseEntity.ok(result);
    }
}
