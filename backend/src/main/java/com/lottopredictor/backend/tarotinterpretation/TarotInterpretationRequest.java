package com.lottopredictor.backend.tarotinterpretation;

import java.util.List;

public record TarotInterpretationRequest(String mode, List<CardInput> cards, String zodiacName) {

    public record CardInput(int cardNumber, String nameKo, String keyword, String direction, String positionLabel) {
    }
}
