package com.lottopredictor.backend.api;

import com.lottopredictor.backend.pensionweeklypick.PensionWeeklyPickResult;
import com.lottopredictor.backend.pensionweeklypick.PensionWeeklyPickService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class PensionWeeklyPickController {

    private final PensionWeeklyPickService service;

    public PensionWeeklyPickController(PensionWeeklyPickService service) {
        this.service = service;
    }

    @GetMapping("/api/pension/weekly-pick")
    public PensionWeeklyPickResult current() {
        return service.getCurrent();
    }

    @GetMapping("/api/pension/weekly-pick/history")
    public List<PensionWeeklyPickResult> history(@RequestParam(defaultValue = "5") int limit) {
        return service.getHistory(Math.min(Math.max(limit, 1), 20));
    }
}
