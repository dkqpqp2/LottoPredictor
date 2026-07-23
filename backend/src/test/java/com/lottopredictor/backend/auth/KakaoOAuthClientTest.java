package com.lottopredictor.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class KakaoOAuthClientTest {

    private KakaoOAuthClient buildClientBackedBy(MockRestServiceServer[] serverOut) {
        RestClient.Builder builder = RestClient.builder();
        serverOut[0] = MockRestServiceServer.bindTo(builder).build();
        return new KakaoOAuthClient(builder, "test-client-id", "");
    }

    @Test
    void exchangesTheAuthorizationCodeForAnAccessToken() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        KakaoOAuthClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://kauth.kakao.com/oauth/token"))
                .andExpect(method(POST))
                .andRespond(withSuccess("""
                        { "access_token": "kakao-access-token", "token_type": "bearer" }
                        """, MediaType.APPLICATION_JSON));

        String accessToken = client.exchangeCodeForAccessToken("auth-code", "http://localhost:3000/auth/kakao/callback");

        assertThat(accessToken).isEqualTo("kakao-access-token");
    }

    @Test
    void throwsWhenTheTokenExchangeFails() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        KakaoOAuthClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://kauth.kakao.com/oauth/token"))
                .andRespond(withServerError());

        assertThatThrownBy(() ->
                client.exchangeCodeForAccessToken("auth-code", "http://localhost:3000/auth/kakao/callback"))
                .isInstanceOf(KakaoAuthException.class);
    }

    @Test
    void fetchesTheKakaoUserIdAndNickname() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        KakaoOAuthClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://kapi.kakao.com/v2/user/me"))
                .andExpect(method(GET))
                .andExpect(header("Authorization", "Bearer kakao-access-token"))
                .andRespond(withSuccess("""
                        {
                          "id": 123456789,
                          "kakao_account": { "profile": { "nickname": "홍길동" } }
                        }
                        """, MediaType.APPLICATION_JSON));

        KakaoUserInfo info = client.fetchUserInfo("kakao-access-token");

        assertThat(info.kakaoId()).isEqualTo(123456789L);
        assertThat(info.nickname()).isEqualTo("홍길동");
    }

    @Test
    void throwsWhenFetchingUserInfoFails() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        KakaoOAuthClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://kapi.kakao.com/v2/user/me"))
                .andRespond(withServerError());

        assertThatThrownBy(() -> client.fetchUserInfo("kakao-access-token"))
                .isInstanceOf(KakaoAuthException.class);
    }
}
