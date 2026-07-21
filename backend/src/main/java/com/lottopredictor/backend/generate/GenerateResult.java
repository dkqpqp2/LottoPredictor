package com.lottopredictor.backend.generate;

import java.util.List;

public record GenerateResult(String mode, List<List<Integer>> results) {
}
