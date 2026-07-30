package com.lottopredictor.backend.pensionsavednumber;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "pension_saved_numbers")
public class PensionSavedNumber {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "target_draw_no", nullable = false)
    private Integer targetDrawNo;

    @Column(name = "group_no", nullable = false)
    private Integer groupNo;

    @Column(name = "number", nullable = false)
    private String number;

    @Column(name = "saved_at", nullable = false)
    private Instant savedAt;

    protected PensionSavedNumber() {
    }

    public PensionSavedNumber(Long userId, Integer targetDrawNo, Integer groupNo, String number, Instant savedAt) {
        this.userId = userId;
        this.targetDrawNo = targetDrawNo;
        this.groupNo = groupNo;
        this.number = number;
        this.savedAt = savedAt;
    }

    public Long getId() {
        return id;
    }

    public Integer getTargetDrawNo() {
        return targetDrawNo;
    }

    public Integer getGroupNo() {
        return groupNo;
    }

    public String getNumber() {
        return number;
    }

    public Instant getSavedAt() {
        return savedAt;
    }
}
