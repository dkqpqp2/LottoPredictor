package com.lottopredictor.backend.tarotinterpretation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "tarot_interpretations")
public class TarotInterpretation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String mode;

    @Column(name = "cards_json", nullable = false, columnDefinition = "text")
    private String cardsJson;

    @Column
    private String zodiac;

    @Column(name = "interpretation_text", nullable = false, columnDefinition = "text")
    private String interpretationText;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TarotInterpretation() {
    }

    public TarotInterpretation(
            Long userId,
            String mode,
            String cardsJson,
            String zodiac,
            String interpretationText,
            Instant createdAt
    ) {
        this.userId = userId;
        this.mode = mode;
        this.cardsJson = cardsJson;
        this.zodiac = zodiac;
        this.interpretationText = interpretationText;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getMode() {
        return mode;
    }

    public String getCardsJson() {
        return cardsJson;
    }

    public String getZodiac() {
        return zodiac;
    }

    public String getInterpretationText() {
        return interpretationText;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
