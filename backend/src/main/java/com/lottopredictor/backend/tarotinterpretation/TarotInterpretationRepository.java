package com.lottopredictor.backend.tarotinterpretation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TarotInterpretationRepository extends JpaRepository<TarotInterpretation, Long> {

    List<TarotInterpretation> findByUserIdOrderByCreatedAtDesc(Long userId);
}
