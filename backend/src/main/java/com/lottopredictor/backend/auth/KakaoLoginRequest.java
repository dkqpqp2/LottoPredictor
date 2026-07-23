package com.lottopredictor.backend.auth;

public record KakaoLoginRequest(String code, String redirectUri) {
}
