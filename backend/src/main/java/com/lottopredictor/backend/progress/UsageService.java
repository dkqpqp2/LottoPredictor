package com.lottopredictor.backend.progress;

import com.lottopredictor.backend.auth.User;
import com.lottopredictor.backend.auth.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class UsageService {

    private static final int USAGE_POINTS = 1;
    private static final int VISIT_POINTS = 2;
    private static final int STREAK_BONUS_POINTS = 10;
    private static final int STREAK_BONUS_DAYS = 7;

    private final UserRepository userRepository;
    private final DailyUsageRepository dailyUsageRepository;

    public UsageService(UserRepository userRepository, DailyUsageRepository dailyUsageRepository) {
        this.userRepository = userRepository;
        this.dailyUsageRepository = dailyUsageRepository;
    }

    public void recordVisit(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        LocalDate today = LocalDate.now();
        if (today.equals(user.getLastActiveDate())) {
            return;
        }

        boolean consecutive = user.getLastActiveDate() != null
                && user.getLastActiveDate().equals(today.minusDays(1));
        int newStreak = consecutive ? user.getCurrentStreak() + 1 : 1;
        user.setCurrentStreak(newStreak);
        user.setLastActiveDate(today);
        user.addPoints(VISIT_POINTS);
        if (newStreak % STREAK_BONUS_DAYS == 0) {
            user.addPoints(STREAK_BONUS_POINTS);
        }
        userRepository.save(user);
    }

    public boolean consume(Long userId, Feature feature) {
        User user = userRepository.findById(userId).orElseThrow();
        Tier tier = TierPolicy.tierForPoints(user.getTotalPoints());
        int limit = TierPolicy.dailyLimit(tier, feature);

        LocalDate today = LocalDate.now();
        DailyUsage usage = dailyUsageRepository
                .findByUserIdAndUsageDateAndFeature(userId, today, feature)
                .orElseGet(() -> new DailyUsage(userId, today, feature, 0));

        if (usage.getCount() >= limit) {
            return false;
        }

        usage.increment();
        dailyUsageRepository.save(usage);
        user.addPoints(USAGE_POINTS);
        userRepository.save(user);
        return true;
    }

    public ProgressResponse getProgress(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        Tier tier = TierPolicy.tierForPoints(user.getTotalPoints());
        LocalDate today = LocalDate.now();
        int tarotUsed = usageCountFor(userId, today, Feature.TAROT);
        int generateUsed = usageCountFor(userId, today, Feature.GENERATE);
        return new ProgressResponse(
                tier.label(),
                user.getTotalPoints(),
                TierPolicy.pointsToNextTier(user.getTotalPoints()),
                new ProgressResponse.UsageInfo(tarotUsed, TierPolicy.dailyLimit(tier, Feature.TAROT)),
                new ProgressResponse.UsageInfo(generateUsed, TierPolicy.dailyLimit(tier, Feature.GENERATE))
        );
    }

    private int usageCountFor(Long userId, LocalDate date, Feature feature) {
        return dailyUsageRepository.findByUserIdAndUsageDateAndFeature(userId, date, feature)
                .map(DailyUsage::getCount)
                .orElse(0);
    }
}
