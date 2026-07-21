package com.lottopredictor.backend.draw;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LottoDrawRepository extends JpaRepository<LottoDraw, Integer> {

    @Query("select max(d.drawNo) from LottoDraw d")
    Optional<Integer> findMaxDrawNo();

    List<LottoDraw> findByDrawDate(LocalDate drawDate);

    List<LottoDraw> findAllByOrderByDrawNoDesc(Pageable pageable);
}
