package com.lottopredictor.backend.pensionweeklypick;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "pension_weekly_picks")
public class PensionWeeklyPick {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "target_draw_no", nullable = false)
    private Integer targetDrawNo;

    @Column(name = "group_no", nullable = false)
    private Integer groupNo;

    @Column(name = "number", nullable = false)
    private String number;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected PensionWeeklyPick() {
    }

    public PensionWeeklyPick(LocalDate weekStart, Integer targetDrawNo, Integer groupNo, String number) {
        this.weekStart = weekStart;
        this.targetDrawNo = targetDrawNo;
        this.groupNo = groupNo;
        this.number = number;
    }

    public Long getId() {
        return id;
    }

    public LocalDate getWeekStart() {
        return weekStart;
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

    public Instant getCreatedAt() {
        return createdAt;
    }
}
