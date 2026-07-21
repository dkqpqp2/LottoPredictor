package com.lottopredictor.backend.api;

import com.lottopredictor.backend.weeklypick.WeeklyPickResult;
import com.lottopredictor.backend.weeklypick.WeeklyPickService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class WeeklyPickController {

    private final WeeklyPickService service;

    public WeeklyPickController(WeeklyPickService service) {
        this.service = service;
    }

    @GetMapping("/api/weekly-pick")
    public WeeklyPickResult current() {
        return service.getCurrentWeekResult();
    }

    @GetMapping("/api/weekly-pick/history")
    public List<WeeklyPickResult> history(@RequestParam(defaultValue = "5") int limit) {
        return service.getHistory(Math.min(Math.max(limit, 1), 20));
    }
}
