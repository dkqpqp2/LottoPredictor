package com.lottopredictor.backend.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kakao_id", nullable = false, unique = true)
    private Long kakaoId;

    @Column(name = "nickname", nullable = false)
    private String nickname;

    @Column(name = "total_points", nullable = false)
    private int totalPoints;

    @Column(name = "current_streak", nullable = false)
    private int currentStreak;

    @Column(name = "last_active_date")
    private LocalDate lastActiveDate;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected User() {
    }

    public User(Long kakaoId, String nickname) {
        this.kakaoId = kakaoId;
        this.nickname = nickname;
    }

    public Long getId() {
        return id;
    }

    public Long getKakaoId() {
        return kakaoId;
    }

    public String getNickname() {
        return nickname;
    }

    public int getTotalPoints() {
        return totalPoints;
    }

    public int getCurrentStreak() {
        return currentStreak;
    }

    public LocalDate getLastActiveDate() {
        return lastActiveDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void updateNickname(String nickname) {
        this.nickname = nickname;
    }

    public void addPoints(int amount) {
        this.totalPoints += amount;
    }

    public void setCurrentStreak(int streak) {
        this.currentStreak = streak;
    }

    public void setLastActiveDate(LocalDate date) {
        this.lastActiveDate = date;
    }
}
