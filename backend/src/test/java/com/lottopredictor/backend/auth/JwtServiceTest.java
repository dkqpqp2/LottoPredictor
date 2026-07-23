package com.lottopredictor.backend.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long!!";

    @Test
    void issuesATokenThatParsesBackToTheSameUserIdAndNickname() {
        JwtService service = new JwtService(SECRET);

        String token = service.issue(42L, "홍길동");
        var parsed = service.parse(token);

        assertThat(parsed).isPresent();
        assertThat(parsed.get().userId()).isEqualTo(42L);
        assertThat(parsed.get().nickname()).isEqualTo("홍길동");
    }

    @Test
    void rejectsATokenSignedWithADifferentSecret() {
        JwtService issuer = new JwtService(SECRET);
        JwtService verifier = new JwtService("a-completely-different-secret-that-is-long-enough!!");

        String token = issuer.issue(42L, "홍길동");

        assertThat(verifier.parse(token)).isEmpty();
    }

    @Test
    void rejectsAMalformedToken() {
        JwtService service = new JwtService(SECRET);

        assertThat(service.parse("not-a-real-token")).isEmpty();
    }
}
