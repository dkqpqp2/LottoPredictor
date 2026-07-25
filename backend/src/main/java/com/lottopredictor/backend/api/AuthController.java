package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthService;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.auth.JwtService;
import com.lottopredictor.backend.auth.KakaoAuthException;
import com.lottopredictor.backend.auth.KakaoLoginRequest;
import com.lottopredictor.backend.auth.KakaoLoginResponse;
import com.lottopredictor.backend.auth.KakaoOAuthClient;
import com.lottopredictor.backend.auth.KakaoUserInfo;
import com.lottopredictor.backend.auth.MeResponse;
import com.lottopredictor.backend.auth.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final KakaoOAuthClient kakaoOAuthClient;
    private final AuthService authService;
    private final JwtService jwtService;
    private final Long adminUserId;

    public AuthController(
            KakaoOAuthClient kakaoOAuthClient,
            AuthService authService,
            JwtService jwtService,
            @Value("${admin.user-id}") Long adminUserId
    ) {
        this.kakaoOAuthClient = kakaoOAuthClient;
        this.authService = authService;
        this.jwtService = jwtService;
        this.adminUserId = adminUserId;
    }

    @PostMapping("/api/auth/kakao/login")
    public ResponseEntity<KakaoLoginResponse> kakaoLogin(@RequestBody KakaoLoginRequest request) {
        try {
            String accessToken = kakaoOAuthClient.exchangeCodeForAccessToken(request.code(), request.redirectUri());
            KakaoUserInfo info = kakaoOAuthClient.fetchUserInfo(accessToken);
            User user = authService.loginOrRegister(info);
            String jwt = jwtService.issue(user.getId(), user.getNickname());
            return ResponseEntity.ok(new KakaoLoginResponse(jwt, user.getNickname(), adminUserId.equals(user.getId())));
        } catch (KakaoAuthException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/api/auth/me")
    public MeResponse me(@AuthPrincipal AuthenticatedUser user) {
        return new MeResponse(user.nickname(), adminUserId.equals(user.userId()));
    }
}
