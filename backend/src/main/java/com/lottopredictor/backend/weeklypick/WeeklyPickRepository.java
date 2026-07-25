package com.lottopredictor.backend.weeklypick;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WeeklyPickRepository extends JpaRepository<WeeklyPick, Long> {

    Optional<WeeklyPick> findTopByOrderByIdDesc();

    List<WeeklyPick> findByIdLessThanOrderByIdDesc(Long id, Pageable pageable);
}
