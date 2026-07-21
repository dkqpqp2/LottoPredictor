package com.lottopredictor.backend.api;

import com.lottopredictor.backend.draw.LottoDrawRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/draws")
public class DrawController {

    private final LottoDrawRepository repository;

    public DrawController(LottoDrawRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<DrawResponse> list(
            @RequestParam(required = false) Integer drawNo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        if (drawNo != null) {
            return repository.findById(drawNo).map(DrawResponse::from).map(List::of).orElseGet(List::of);
        }
        if (date != null) {
            return repository.findByDrawDate(date).stream().map(DrawResponse::from).toList();
        }
        return repository.findAllByOrderByDrawNoDesc(PageRequest.of(page, size)).stream()
                .map(DrawResponse::from)
                .toList();
    }
}
