package com.lottopredictor.backend.admin;

import com.lottopredictor.backend.auth.User;
import com.lottopredictor.backend.auth.UserRepository;
import com.lottopredictor.backend.progress.Tier;
import com.lottopredictor.backend.progress.TierPolicy;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AdminService {

    private final UserRepository userRepository;

    public AdminService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<AdminUserResponse> listUsers() {
        return userRepository.findAll().stream().map(this::toResponse).toList();
    }

    public AdminUserResponse setForcedTier(Long userId, String tier) {
        User user = userRepository.findById(userId).orElseThrow();
        user.setForcedTier(tier);
        userRepository.save(user);
        return toResponse(user);
    }

    private AdminUserResponse toResponse(User user) {
        Tier tier = TierPolicy.effectiveTier(user.getForcedTier(), user.getTotalPoints());
        return new AdminUserResponse(
                user.getId(),
                user.getNickname(),
                tier.label(),
                user.getTotalPoints(),
                user.getForcedTier(),
                user.getCreatedAt()
        );
    }
}
