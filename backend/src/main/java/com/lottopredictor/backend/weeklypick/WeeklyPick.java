package com.lottopredictor.backend.weeklypick;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "weekly_picks")
public class WeeklyPick {

    @Id
    @Column(name = "week_start")
    private LocalDate weekStart;

    @Column(name = "target_draw_no", nullable = false)
    private Integer targetDrawNo;

    @Column(name = "num1", nullable = false)
    private Integer num1;

    @Column(name = "num2", nullable = false)
    private Integer num2;

    @Column(name = "num3", nullable = false)
    private Integer num3;

    @Column(name = "num4", nullable = false)
    private Integer num4;

    @Column(name = "num5", nullable = false)
    private Integer num5;

    @Column(name = "num6", nullable = false)
    private Integer num6;

    @Column(name = "mode", nullable = false)
    private String mode;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected WeeklyPick() {
    }

    public WeeklyPick(
            LocalDate weekStart,
            Integer targetDrawNo,
            Integer num1,
            Integer num2,
            Integer num3,
            Integer num4,
            Integer num5,
            Integer num6,
            String mode
    ) {
        this.weekStart = weekStart;
        this.targetDrawNo = targetDrawNo;
        this.num1 = num1;
        this.num2 = num2;
        this.num3 = num3;
        this.num4 = num4;
        this.num5 = num5;
        this.num6 = num6;
        this.mode = mode;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    public Integer getTargetDrawNo() {
        return targetDrawNo;
    }

    public String getMode() {
        return mode;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<Integer> numbers() {
        return List.of(num1, num2, num3, num4, num5, num6);
    }
}
