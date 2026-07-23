package com.lottopredictor.backend.auth;

import com.fasterxml.jackson.annotation.JsonProperty;

public record KakaoUserInfoResponse(
        @JsonProperty("id") Long id,
        @JsonProperty("kakao_account") KakaoAccount kakaoAccount
) {

    public record KakaoAccount(@JsonProperty("profile") Profile profile) {

        public record Profile(@JsonProperty("nickname") String nickname) {
        }
    }
}
