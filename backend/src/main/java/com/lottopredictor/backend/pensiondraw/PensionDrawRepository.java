package com.lottopredictor.backend.pensiondraw;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PensionDrawRepository extends JpaRepository<PensionDraw, Integer> {

    @Query("select max(d.drawNo) from PensionDraw d")
    Optional<Integer> findMaxDrawNo();

    List<PensionDraw> findAllByOrderByDrawNoDesc(Pageable pageable);
}
