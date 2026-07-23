package com.lottopredictor.backend.auth;

import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User loginOrRegister(KakaoUserInfo info) {
        return userRepository.findByKakaoId(info.kakaoId())
                .map(existing -> {
                    existing.updateNickname(info.nickname());
                    return userRepository.save(existing);
                })
                .orElseGet(() -> userRepository.save(new User(info.kakaoId(), info.nickname())));
    }
}
