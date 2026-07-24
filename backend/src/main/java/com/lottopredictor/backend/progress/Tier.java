package com.lottopredictor.backend.progress;

public enum Tier {
    BEGINNER("초심자"),
    APPRENTICE("견습생"),
    EXPERT("고수"),
    MASTER("마스터"),
    LOTTO_GOD("뽑기의 신");

    private final String label;

    Tier(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
