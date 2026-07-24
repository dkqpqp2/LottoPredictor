package com.lottopredictor.backend.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "daily_usage")
public class DailyUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "usage_date", nullable = false)
    private LocalDate usageDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature", nullable = false)
    private Feature feature;

    @Column(name = "count", nullable = false)
    private int count;

    protected DailyUsage() {
    }

    public DailyUsage(Long userId, LocalDate usageDate, Feature feature, int count) {
        this.userId = userId;
        this.usageDate = usageDate;
        this.feature = feature;
        this.count = count;
    }

    public Long getId() {
        return id;
    }

    public int getCount() {
        return count;
    }

    public void increment() {
        this.count += 1;
    }
}
