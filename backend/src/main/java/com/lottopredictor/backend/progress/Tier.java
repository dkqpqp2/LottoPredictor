package com.lottopredictor.backend.progress;

public enum Tier {
    BEGINNER("뽑기 초심자"),
    APPRENTICE("뽑기 견습생"),
    EXPERT("뽑기 고수"),
    LOTTO_GOD("뽑기의 신");

    private final String label;

    Tier(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
