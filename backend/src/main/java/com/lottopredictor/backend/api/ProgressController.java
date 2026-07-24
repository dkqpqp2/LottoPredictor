package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.ProgressResponse;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProgressController {

    private final UsageService usageService;

    public ProgressController(UsageService usageService) {
        this.usageService = usageService;
    }

    @GetMapping("/api/progress/me")
    public ProgressResponse me(@AuthPrincipal AuthenticatedUser principal) {
        usageService.recordVisit(principal.userId());
        return usageService.getProgress(principal.userId());
    }

    @PostMapping("/api/progress/tarot-usage")
    public ResponseEntity<ProgressResponse> tarotUsage(@AuthPrincipal AuthenticatedUser principal) {
        if (!usageService.consume(principal.userId(), Feature.TAROT)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        return ResponseEntity.ok(usageService.getProgress(principal.userId()));
    }
}
