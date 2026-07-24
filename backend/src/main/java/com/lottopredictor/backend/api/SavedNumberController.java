package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.savednumber.SaveNumberRequest;
import com.lottopredictor.backend.savednumber.SavedNumberResponse;
import com.lottopredictor.backend.savednumber.SavedNumberService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class SavedNumberController {

    private final SavedNumberService savedNumberService;

    public SavedNumberController(SavedNumberService savedNumberService) {
        this.savedNumberService = savedNumberService;
    }

    @PostMapping("/api/saved-numbers")
    public SavedNumberResponse save(@RequestBody SaveNumberRequest request, @AuthPrincipal AuthenticatedUser principal) {
        return savedNumberService.save(principal.userId(), request.source(), request.numbers());
    }

    @GetMapping("/api/saved-numbers")
    public List<SavedNumberResponse> list(@AuthPrincipal AuthenticatedUser principal) {
        return savedNumberService.getSaved(principal.userId());
    }
}
