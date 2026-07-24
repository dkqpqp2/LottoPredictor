package com.lottopredictor.backend.progress;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DailyUsageRepository extends JpaRepository<DailyUsage, Long> {

    Optional<DailyUsage> findByUserIdAndUsageDateAndFeature(Long userId, LocalDate usageDate, Feature feature);
}
