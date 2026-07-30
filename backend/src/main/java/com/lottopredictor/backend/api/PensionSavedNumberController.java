package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.pensionsavednumber.PensionSavedNumberResponse;
import com.lottopredictor.backend.pensionsavednumber.PensionSavedNumberService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class PensionSavedNumberController {

    private final PensionSavedNumberService pensionSavedNumberService;

    public PensionSavedNumberController(PensionSavedNumberService pensionSavedNumberService) {
        this.pensionSavedNumberService = pensionSavedNumberService;
    }

    @GetMapping("/api/pension/saved-numbers")
    public List<PensionSavedNumberResponse> list(@AuthPrincipal AuthenticatedUser principal) {
        return pensionSavedNumberService.getSaved(principal.userId());
    }
}
