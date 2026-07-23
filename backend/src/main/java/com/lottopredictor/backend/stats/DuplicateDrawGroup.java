package com.lottopredictor.backend.stats;

import java.util.List;

public record DuplicateDrawGroup(List<Integer> numbers, List<Integer> drawNos) {
}
