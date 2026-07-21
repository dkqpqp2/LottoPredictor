package com.lottopredictor.backend.api;

import com.lottopredictor.backend.generate.GenerateResult;
import com.lottopredictor.backend.generate.NumberGenerationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GenerateController {

    private final NumberGenerationService service;

    public GenerateController(NumberGenerationService service) {
        this.service = service;
    }

    @GetMapping("/api/generate")
    public GenerateResult generate(
            @RequestParam(defaultValue = "weighted") String mode,
            @RequestParam(defaultValue = "1") int sets
    ) {
        int clampedSets = Math.min(Math.max(sets, 1), 10);
        String normalizedMode = "random".equals(mode) ? "random" : "weighted";
        return service.generate(normalizedMode, clampedSets);
    }
}
