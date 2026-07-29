package com.lottopredictor.backend.pensiondraw;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "pension_draws")
public class PensionDraw {

    @Id
    @Column(name = "draw_no")
    private Integer drawNo;

    @Column(name = "draw_date", nullable = false)
    private LocalDate drawDate;

    @Column(name = "group_no", nullable = false)
    private Integer groupNo;

    @Column(name = "number", nullable = false)
    private String number;

    @Column(name = "bonus_number", nullable = false)
    private String bonusNumber;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected PensionDraw() {
    }

    public PensionDraw(Integer drawNo, LocalDate drawDate, Integer groupNo, String number, String bonusNumber) {
        this.drawNo = drawNo;
        this.drawDate = drawDate;
        this.groupNo = groupNo;
        this.number = number;
        this.bonusNumber = bonusNumber;
    }

    public Integer getDrawNo() {
        return drawNo;
    }

    public LocalDate getDrawDate() {
        return drawDate;
    }

    public Integer getGroupNo() {
        return groupNo;
    }

    public String getNumber() {
        return number;
    }

    public String getBonusNumber() {
        return bonusNumber;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
