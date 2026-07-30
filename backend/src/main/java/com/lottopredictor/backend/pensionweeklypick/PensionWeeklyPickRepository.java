package com.lottopredictor.backend.pensionweeklypick;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PensionWeeklyPickRepository extends JpaRepository<PensionWeeklyPick, Long> {

    Optional<PensionWeeklyPick> findTopByOrderByIdDesc();

    List<PensionWeeklyPick> findByIdLessThanOrderByIdDesc(Long id, Pageable pageable);
}
