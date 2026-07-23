package com.lottopredictor.backend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class KakaoOAuthClient {

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;

    public KakaoOAuthClient(
            RestClient.Builder restClientBuilder,
            @Value("${kakao.client-id}") String clientId,
            @Value("${kakao.client-secret:}") String clientSecret
    ) {
        this.restClient = restClientBuilder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public String exchangeCodeForAccessToken(String code, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", clientId);
        form.add("redirect_uri", redirectUri);
        form.add("code", code);
        if (!clientSecret.isBlank()) {
            form.add("client_secret", clientSecret);
        }

        KakaoTokenResponse response;
        try {
            response = restClient.post()
                    .uri("https://kauth.kakao.com/oauth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(KakaoTokenResponse.class);
        } catch (RestClientException e) {
            throw new KakaoAuthException("failed to exchange kakao code: " + e.getMessage());
        }

        if (response == null || response.accessToken() == null) {
            throw new KakaoAuthException("empty kakao token response");
        }
        return response.accessToken();
    }

    public KakaoUserInfo fetchUserInfo(String kakaoAccessToken) {
        KakaoUserInfoResponse response;
        try {
            response = restClient.get()
                    .uri("https://kapi.kakao.com/v2/user/me")
                    .header("Authorization", "Bearer " + kakaoAccessToken)
                    .retrieve()
                    .body(KakaoUserInfoResponse.class);
        } catch (RestClientException e) {
            throw new KakaoAuthException("failed to fetch kakao user info: " + e.getMessage());
        }

        if (response == null || response.kakaoAccount() == null || response.kakaoAccount().profile() == null) {
            throw new KakaoAuthException("empty kakao user info response");
        }
        return new KakaoUserInfo(response.id(), response.kakaoAccount().profile().nickname());
    }
}
