package com.lottopredictor.backend.savednumber;

import java.util.List;

public record SaveNumberRequest(String source, List<Integer> numbers) {
}
