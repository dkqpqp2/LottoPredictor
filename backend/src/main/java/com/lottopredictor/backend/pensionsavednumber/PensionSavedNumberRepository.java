package com.lottopredictor.backend.pensionsavednumber;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PensionSavedNumberRepository extends JpaRepository<PensionSavedNumber, Long> {

    List<PensionSavedNumber> findByUserIdOrderBySavedAtDesc(Long userId);
}
