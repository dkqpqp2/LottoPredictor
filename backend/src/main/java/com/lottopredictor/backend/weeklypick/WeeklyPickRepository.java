package com.lottopredictor.backend.weeklypick;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface WeeklyPickRepository extends JpaRepository<WeeklyPick, LocalDate> {

    List<WeeklyPick> findByWeekStartLessThanOrderByWeekStartDesc(LocalDate weekStart, Pageable pageable);
}
