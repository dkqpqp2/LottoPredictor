package com.lottopredictor.backend.draw;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "lotto_draws")
public class LottoDraw {

    @Id
    @Column(name = "draw_no")
    private Integer drawNo;

    @Column(name = "draw_date", nullable = false)
    private LocalDate drawDate;

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

    @Column(name = "bonus_num", nullable = false)
    private Integer bonusNum;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected LottoDraw() {
    }

    public LottoDraw(
            Integer drawNo,
            LocalDate drawDate,
            Integer num1,
            Integer num2,
            Integer num3,
            Integer num4,
            Integer num5,
            Integer num6,
            Integer bonusNum
    ) {
        this.drawNo = drawNo;
        this.drawDate = drawDate;
        this.num1 = num1;
        this.num2 = num2;
        this.num3 = num3;
        this.num4 = num4;
        this.num5 = num5;
        this.num6 = num6;
        this.bonusNum = bonusNum;
    }

    public Integer getDrawNo() {
        return drawNo;
    }

    public LocalDate getDrawDate() {
        return drawDate;
    }

    public Integer getNum1() {
        return num1;
    }

    public Integer getNum2() {
        return num2;
    }

    public Integer getNum3() {
        return num3;
    }

    public Integer getNum4() {
        return num4;
    }

    public Integer getNum5() {
        return num5;
    }

    public Integer getNum6() {
        return num6;
    }

    public Integer getBonusNum() {
        return bonusNum;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public int[] numbers() {
        return new int[] { num1, num2, num3, num4, num5, num6 };
    }
}
