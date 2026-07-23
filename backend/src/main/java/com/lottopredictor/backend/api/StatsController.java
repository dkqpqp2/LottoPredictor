package com.lottopredictor.backend.api;

import com.lottopredictor.backend.stats.DuplicateDrawGroup;
import com.lottopredictor.backend.stats.NumberStat;
import com.lottopredictor.backend.stats.StatsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class StatsController {

    private final StatsService service;

    public StatsController(StatsService service) {
        this.service = service;
    }

    @GetMapping("/api/stats")
    public List<NumberStat> stats() {
        return service.computeStats();
    }

    @GetMapping("/api/duplicate-draws")
    public List<DuplicateDrawGroup> duplicateDraws() {
        return service.findDuplicateCombinations();
    }
}
