package com.lottopredictor.backend.pensiongenerate;

import org.springframework.stereotype.Service;

import java.util.function.DoubleSupplier;

@Service
public class PensionNumberGenerationService {

    public PensionGenerateResult generate() {
        return generate(Math::random);
    }

    PensionGenerateResult generate(DoubleSupplier rng) {
        int groupNo = 1 + (int) (rng.getAsDouble() * 5);
        String number = String.format("%06d", (int) (rng.getAsDouble() * 1_000_000));
        return new PensionGenerateResult(groupNo, number);
    }
}
