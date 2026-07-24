package com.lottopredictor.backend.savednumber;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "saved_numbers")
public class SavedNumber {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "source", nullable = false)
    private String source;

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

    @Column(name = "saved_at", nullable = false)
    private Instant savedAt;

    protected SavedNumber() {
    }

    public SavedNumber(
            Long userId,
            String source,
            Integer targetDrawNo,
            Integer num1,
            Integer num2,
            Integer num3,
            Integer num4,
            Integer num5,
            Integer num6,
            Instant savedAt
    ) {
        this.userId = userId;
        this.source = source;
        this.targetDrawNo = targetDrawNo;
        this.num1 = num1;
        this.num2 = num2;
        this.num3 = num3;
        this.num4 = num4;
        this.num5 = num5;
        this.num6 = num6;
        this.savedAt = savedAt;
    }

    public Long getId() {
        return id;
    }

    public String getSource() {
        return source;
    }

    public Integer getTargetDrawNo() {
        return targetDrawNo;
    }

    public Instant getSavedAt() {
        return savedAt;
    }

    public List<Integer> numbers() {
        return List.of(num1, num2, num3, num4, num5, num6);
    }
}
