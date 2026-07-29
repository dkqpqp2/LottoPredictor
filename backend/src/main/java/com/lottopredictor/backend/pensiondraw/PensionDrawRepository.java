package com.lottopredictor.backend.pensiondraw;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface PensionDrawRepository extends JpaRepository<PensionDraw, Integer> {

    @Query("select max(d.drawNo) from PensionDraw d")
    Optional<Integer> findMaxDrawNo();
}
