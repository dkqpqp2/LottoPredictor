package com.lottopredictor.backend.api;

import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pension/draws")
public class PensionDrawController {

    private final PensionDrawRepository repository;

    public PensionDrawController(PensionDrawRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<PensionDrawResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return repository.findAllByOrderByDrawNoDesc(PageRequest.of(page, size)).stream()
                .map(PensionDrawResponse::from)
                .toList();
    }
}
