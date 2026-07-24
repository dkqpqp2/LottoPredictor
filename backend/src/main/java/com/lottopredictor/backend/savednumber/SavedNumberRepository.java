package com.lottopredictor.backend.savednumber;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavedNumberRepository extends JpaRepository<SavedNumber, Long> {

    List<SavedNumber> findByUserIdOrderBySavedAtDesc(Long userId);
}
