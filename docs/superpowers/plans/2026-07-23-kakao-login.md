# 카카오 OAuth 로그인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카카오 인가 코드 플로우 + JWT로 로그인/로그아웃을 구현하고, 향후 엔드포인트를 로그인 필수로 잠글 수 있는 재사용 가능한 인증 메커니즘을 만든다.

**Architecture:** 프론트(Vercel)가 카카오 인가 코드를 받아 백엔드(Render)의 `/api/auth/kakao/login`으로 전달 → 백엔드가 카카오 토큰 교환 + 사용자 조회 + `users` 테이블 upsert 후 JWT(30일, HS256, 리프레시 없음) 발급 → 프론트는 토큰을 `Authorization: Bearer` 헤더로 사용. 백엔드-프론트가 서로 다른 도메인이라 쿠키 대신 헤더 방식을 쓴다. 향후 보호할 엔드포인트는 `@AuthPrincipal AuthenticatedUser` 파라미터만 추가하면 된다.

**Tech Stack:** Spring Boot 4.1.0 (Java 21, Spring Data JPA, `RestClient`), `jjwt` 0.12.6, Next.js 16 App Router (TypeScript, CSS Modules), Vitest.

## Global Constraints

- JWT: HS256, 30일 만료, 리프레시 토큰 없음 (스펙 확정 사항)
- 저장할 유저 정보는 카카오 ID + 닉네임만 (프로필 이미지 없음)
- 세션 유지는 JWT + `Authorization` 헤더 (쿠키 방식 아님)
- OAuth 흐름: 프론트가 인가 코드를 받아 백엔드로 전달 (카카오가 백엔드를 직접 호출하지 않음)
- 컨트롤러는 `com.lottopredictor.backend.api` 패키지, 엔티티/서비스/DTO는 `com.lottopredictor.backend.auth` 패키지 (기존 코드베이스 컨벤션)
- DB 마이그레이션은 `db/migrations/000N_*.sql`에 순번 추가 (기존 컨벤션, `ddl-auto=validate`라 마이그레이션은 Supabase에 수동 적용 필요)
- 프론트 lib 파일은 상대경로 import 사용 (`@/*` 별칭 있지만 기존 코드가 전부 상대경로 사용 중)
- 기존 vitest 설정은 `environment: 'node'`이며 jsdom/React Testing Library 없음 → React 컴포넌트(AuthContext, 콜백 페이지, Nav)는 기존 컨벤션대로 자동 테스트 없이 타입체크 + 브라우저 수동 확인으로 검증. 순수 로직 파일(`lib/auth.ts`)만 vitest 단위 테스트 작성
- Next.js 16: `useSearchParams`를 쓰는 클라이언트 컴포넌트는 프로덕션 빌드에서 `<Suspense>`로 감싸지 않으면 빌드 실패함 (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` 확인됨)

---

### Task 1: `users` 테이블 + `User` 엔티티 + `UserRepository`

**Files:**
- Create: `db/migrations/0003_create_users.sql`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/User.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/UserRepository.java`

**Interfaces:**
- Produces: `User(Long kakaoId, String nickname)` 생성자, `getId()`, `getKakaoId()`, `getNickname()`, `getCreatedAt()`, `updateNickname(String nickname)`. `UserRepository extends JpaRepository<User, Long>`에 `findByKakaoId(Long kakaoId): Optional<User>`.

이 코드베이스는 리포지토리/엔티티 자체를 직접 테스트하지 않는 컨벤션이다 (`LottoDrawRepository`도 전용 테스트 파일이 없음). 대신 Task 5의 `AuthServiceTest`가 `UserRepository`를 목(mock)으로 사용해 동작을 검증한다. 이 태스크는 컴파일 확인으로 충분하다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
create table if not exists users (
  id bigserial primary key,
  kakao_id bigint not null unique,
  nickname varchar(80) not null,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: `User` 엔티티 작성**

```java
package com.lottopredictor.backend.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kakao_id", nullable = false, unique = true)
    private Long kakaoId;

    @Column(name = "nickname", nullable = false)
    private String nickname;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected User() {
    }

    public User(Long kakaoId, String nickname) {
        this.kakaoId = kakaoId;
        this.nickname = nickname;
    }

    public Long getId() {
        return id;
    }

    public Long getKakaoId() {
        return kakaoId;
    }

    public String getNickname() {
        return nickname;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void updateNickname(String nickname) {
        this.nickname = nickname;
    }
}
```

- [ ] **Step 3: `UserRepository` 작성**

```java
package com.lottopredictor.backend.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByKakaoId(Long kakaoId);
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0003_create_users.sql backend/src/main/java/com/lottopredictor/backend/auth/User.java backend/src/main/java/com/lottopredictor/backend/auth/UserRepository.java
git commit -m "Add users table, entity, and repository"
```

---

### Task 2: `JwtService` + `AuthenticatedUser`

**Files:**
- Modify: `backend/build.gradle`
- Modify: `backend/src/main/resources/application.properties`
- Modify: `backend/src/main/resources/application-local.properties.example`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/AuthenticatedUser.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/JwtService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/auth/JwtServiceTest.java`

**Interfaces:**
- Produces: `record AuthenticatedUser(Long userId, String nickname)`. `JwtService(String secret)` 생성자(`@Value("${jwt.secret}")` 주입), `issue(Long userId, String nickname): String`, `parse(String token): Optional<AuthenticatedUser>` (변조/만료/형식오류 시 `Optional.empty()`).

- [ ] **Step 1: `build.gradle`에 jjwt 의존성 추가**

`backend/build.gradle`의 `dependencies { ... }` 블록에 아래 세 줄을 `runtimeOnly 'org.postgresql:postgresql'` 다음 줄에 추가:

```gradle
	implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
	runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
	runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'
```

- [ ] **Step 2: `application.properties`에 시크릿 설정 추가**

`backend/src/main/resources/application.properties` 끝에 추가:

```properties
jwt.secret=${JWT_SECRET}
```

- [ ] **Step 3: `application-local.properties.example`에 로컬용 값 추가**

`backend/src/main/resources/application-local.properties.example` 끝에 추가:

```properties
jwt.secret=<32바이트 이상의 임의 문자열, 예: openssl rand -base64 32 결과>
```

- [ ] **Step 4: 실패하는 테스트 작성**

```java
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
```

- [ ] **Step 5: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.auth.JwtServiceTest"`
Expected: FAIL (컴파일 에러 — `AuthenticatedUser`, `JwtService`가 아직 없음)

- [ ] **Step 6: `AuthenticatedUser` 작성**

```java
package com.lottopredictor.backend.auth;

public record AuthenticatedUser(Long userId, String nickname) {
}
```

- [ ] **Step 7: `JwtService` 작성**

```java
package com.lottopredictor.backend.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;

@Component
public class JwtService {

    private static final long EXPIRY_DAYS = 30;

    private final SecretKey key;

    public JwtService(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String issue(Long userId, String nickname) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("nickname", nickname)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(EXPIRY_DAYS, ChronoUnit.DAYS)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public Optional<AuthenticatedUser> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Long userId = Long.valueOf(claims.getSubject());
            String nickname = claims.get("nickname", String.class);
            return Optional.of(new AuthenticatedUser(userId, nickname));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
```

- [ ] **Step 8: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.auth.JwtServiceTest"`
Expected: `BUILD SUCCESSFUL`, 3 tests passed

- [ ] **Step 9: Commit**

```bash
git add backend/build.gradle backend/src/main/resources/application.properties backend/src/main/resources/application-local.properties.example backend/src/main/java/com/lottopredictor/backend/auth/AuthenticatedUser.java backend/src/main/java/com/lottopredictor/backend/auth/JwtService.java backend/src/test/java/com/lottopredictor/backend/auth/JwtServiceTest.java
git commit -m "Add JWT issuing and verification"
```

---

### Task 3: `@AuthPrincipal` 인자 리졸버

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/AuthPrincipal.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/AuthPrincipalArgumentResolver.java`
- Modify: `backend/src/main/java/com/lottopredictor/backend/config/WebConfig.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/auth/AuthPrincipalArgumentResolverTest.java`

**Interfaces:**
- Consumes: `JwtService.parse(String): Optional<AuthenticatedUser>` (Task 2)
- Produces: `@AuthPrincipal` 애노테이션(파라미터에 부착), `AuthPrincipalArgumentResolver`. 컨트롤러 메서드에 `@AuthPrincipal AuthenticatedUser user` 파라미터를 추가하면 그 엔드포인트는 자동으로 로그인 필수가 됨 (헤더 없음/무효 시 401).

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.lottopredictor.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthPrincipalArgumentResolverTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private NativeWebRequest webRequest;

    @Mock
    private HttpServletRequest servletRequest;

    @Test
    void resolvesTheAuthenticatedUserFromAValidBearerToken() {
        when(webRequest.getNativeRequest()).thenReturn(servletRequest);
        when(servletRequest.getHeader("Authorization")).thenReturn("Bearer valid-token");
        when(jwtService.parse("valid-token")).thenReturn(Optional.of(new AuthenticatedUser(1L, "홍길동")));

        AuthPrincipalArgumentResolver resolver = new AuthPrincipalArgumentResolver(jwtService);
        Object result = resolver.resolveArgument(null, null, webRequest, null);

        assertThat(result).isEqualTo(new AuthenticatedUser(1L, "홍길동"));
    }

    @Test
    void throwsUnauthorizedWhenTheHeaderIsMissing() {
        when(webRequest.getNativeRequest()).thenReturn(servletRequest);
        when(servletRequest.getHeader("Authorization")).thenReturn(null);

        AuthPrincipalArgumentResolver resolver = new AuthPrincipalArgumentResolver(jwtService);

        assertThatThrownBy(() -> resolver.resolveArgument(null, null, webRequest, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void throwsUnauthorizedWhenTheTokenIsInvalid() {
        when(webRequest.getNativeRequest()).thenReturn(servletRequest);
        when(servletRequest.getHeader("Authorization")).thenReturn("Bearer bad-token");
        when(jwtService.parse("bad-token")).thenReturn(Optional.empty());

        AuthPrincipalArgumentResolver resolver = new AuthPrincipalArgumentResolver(jwtService);

        assertThatThrownBy(() -> resolver.resolveArgument(null, null, webRequest, null))
                .isInstanceOf(ResponseStatusException.class);
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.auth.AuthPrincipalArgumentResolverTest"`
Expected: FAIL (컴파일 에러 — `AuthPrincipal`, `AuthPrincipalArgumentResolver`가 아직 없음)

- [ ] **Step 3: `AuthPrincipal` 애노테이션 작성**

```java
package com.lottopredictor.backend.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuthPrincipal {
}
```

- [ ] **Step 4: `AuthPrincipalArgumentResolver` 작성**

```java
package com.lottopredictor.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.server.ResponseStatusException;

@Component
public class AuthPrincipalArgumentResolver implements HandlerMethodArgumentResolver {

    private final JwtService jwtService;

    public AuthPrincipalArgumentResolver(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(AuthPrincipal.class)
                && parameter.getParameterType().equals(AuthenticatedUser.class);
    }

    @Override
    public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
    ) {
        HttpServletRequest request = (HttpServletRequest) webRequest.getNativeRequest();
        String header = request != null ? request.getHeader("Authorization") : null;
        if (header == null || !header.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        String token = header.substring("Bearer ".length());
        return jwtService.parse(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
```

- [ ] **Step 5: `WebConfig`에 리졸버 등록**

`backend/src/main/java/com/lottopredictor/backend/config/WebConfig.java` 전체를 다음으로 교체:

```java
package com.lottopredictor.backend.config;

import com.lottopredictor.backend.auth.AuthPrincipalArgumentResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] frontendOrigins;
    private final AuthPrincipalArgumentResolver authPrincipalArgumentResolver;

    public WebConfig(
            @Value("${lotto.frontend-origin}") String frontendOrigin,
            AuthPrincipalArgumentResolver authPrincipalArgumentResolver
    ) {
        this.frontendOrigins = frontendOrigin.split(",");
        this.authPrincipalArgumentResolver = authPrincipalArgumentResolver;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(frontendOrigins)
                .allowedMethods("GET", "POST")
                .allowedHeaders("*");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(authPrincipalArgumentResolver);
    }
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.auth.AuthPrincipalArgumentResolverTest"`
Expected: `BUILD SUCCESSFUL`, 3 tests passed

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/auth/AuthPrincipal.java backend/src/main/java/com/lottopredictor/backend/auth/AuthPrincipalArgumentResolver.java backend/src/main/java/com/lottopredictor/backend/config/WebConfig.java backend/src/test/java/com/lottopredictor/backend/auth/AuthPrincipalArgumentResolverTest.java
git commit -m "Add reusable @AuthPrincipal argument resolver for protecting endpoints"
```

---

### Task 4: `KakaoOAuthClient`

**Files:**
- Modify: `backend/src/main/resources/application.properties`
- Modify: `backend/src/main/resources/application-local.properties.example`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/KakaoAuthException.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/KakaoUserInfo.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/KakaoTokenResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/KakaoUserInfoResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/KakaoOAuthClient.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/auth/KakaoOAuthClientTest.java`

**Interfaces:**
- Produces: `record KakaoUserInfo(Long kakaoId, String nickname)`, `class KakaoAuthException extends RuntimeException`, `KakaoOAuthClient(RestClient.Builder, String clientId, String clientSecret)` 생성자, `exchangeCodeForAccessToken(String code, String redirectUri): String` (실패 시 `KakaoAuthException`), `fetchUserInfo(String kakaoAccessToken): KakaoUserInfo` (실패 시 `KakaoAuthException`)

- [ ] **Step 1: `application.properties`에 카카오 설정 추가**

`backend/src/main/resources/application.properties` 끝에 추가:

```properties
kakao.client-id=${KAKAO_CLIENT_ID}
kakao.client-secret=${KAKAO_CLIENT_SECRET:}
```

- [ ] **Step 2: `application-local.properties.example`에 로컬용 값 추가**

`backend/src/main/resources/application-local.properties.example` 끝에 추가:

```properties
kakao.client-id=<카카오 개발자센터에서 발급받은 REST API 키>
kakao.client-secret=
```

- [ ] **Step 3: 실패하는 테스트 작성**

```java
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
```

- [ ] **Step 4: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.auth.KakaoOAuthClientTest"`
Expected: FAIL (컴파일 에러 — 아래 클래스들이 아직 없음)

- [ ] **Step 5: `KakaoAuthException` 작성**

```java
package com.lottopredictor.backend.auth;

public class KakaoAuthException extends RuntimeException {

    public KakaoAuthException(String message) {
        super(message);
    }
}
```

- [ ] **Step 6: `KakaoUserInfo` 작성**

```java
package com.lottopredictor.backend.auth;

public record KakaoUserInfo(Long kakaoId, String nickname) {
}
```

- [ ] **Step 7: `KakaoTokenResponse` 작성**

```java
package com.lottopredictor.backend.auth;

import com.fasterxml.jackson.annotation.JsonProperty;

public record KakaoTokenResponse(@JsonProperty("access_token") String accessToken) {
}
```

- [ ] **Step 8: `KakaoUserInfoResponse` 작성**

```java
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
```

- [ ] **Step 9: `KakaoOAuthClient` 작성**

```java
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
```

- [ ] **Step 10: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.auth.KakaoOAuthClientTest"`
Expected: `BUILD SUCCESSFUL`, 4 tests passed

- [ ] **Step 11: Commit**

```bash
git add backend/src/main/resources/application.properties backend/src/main/resources/application-local.properties.example backend/src/main/java/com/lottopredictor/backend/auth/KakaoAuthException.java backend/src/main/java/com/lottopredictor/backend/auth/KakaoUserInfo.java backend/src/main/java/com/lottopredictor/backend/auth/KakaoTokenResponse.java backend/src/main/java/com/lottopredictor/backend/auth/KakaoUserInfoResponse.java backend/src/main/java/com/lottopredictor/backend/auth/KakaoOAuthClient.java backend/src/test/java/com/lottopredictor/backend/auth/KakaoOAuthClientTest.java
git commit -m "Add Kakao OAuth token exchange and user info client"
```

**참고 (구현자가 알아야 할 것):** 카카오 개발자센터 앱의 "카카오 로그인 > 동의항목"에서 닉네임(프로필 정보) 제공에 동의하도록 설정돼 있어야 `kakao_account.profile.nickname`이 응답에 포함된다. 기본 앱 생성 시 보통 활성화되어 있지만, 실제 카카오 앱으로 연동 테스트할 때 없으면 확인이 필요하다.

---

### Task 5: `AuthService` (유저 upsert)

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/AuthService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/auth/AuthServiceTest.java`

**Interfaces:**
- Consumes: `UserRepository.findByKakaoId(Long): Optional<User>`, `UserRepository.save(User): User` (Task 1), `KakaoUserInfo(Long kakaoId, String nickname)` (Task 4)
- Produces: `AuthService(UserRepository)` 생성자, `loginOrRegister(KakaoUserInfo info): User` — 기존 `kakao_id`면 닉네임 갱신 후 재사용, 없으면 신규 생성

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.lottopredictor.backend.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Test
    void createsANewUserWhenTheKakaoIdIsNotSeenBefore() {
        when(userRepository.findByKakaoId(123L)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthService service = new AuthService(userRepository);
        User result = service.loginOrRegister(new KakaoUserInfo(123L, "홍길동"));

        assertThat(result.getKakaoId()).isEqualTo(123L);
        assertThat(result.getNickname()).isEqualTo("홍길동");
    }

    @Test
    void reusesTheExistingUserAndUpdatesTheNicknameOnRepeatLogin() {
        User existing = new User(123L, "옛날닉네임");
        when(userRepository.findByKakaoId(123L)).thenReturn(Optional.of(existing));
        when(userRepository.save(existing)).thenReturn(existing);

        AuthService service = new AuthService(userRepository);
        User result = service.loginOrRegister(new KakaoUserInfo(123L, "새닉네임"));

        assertThat(result).isSameAs(existing);
        assertThat(result.getNickname()).isEqualTo("새닉네임");
        verify(userRepository).save(existing);
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.auth.AuthServiceTest"`
Expected: FAIL (컴파일 에러 — `AuthService`가 아직 없음)

- [ ] **Step 3: `AuthService` 작성**

```java
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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.auth.AuthServiceTest"`
Expected: `BUILD SUCCESSFUL`, 2 tests passed

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/auth/AuthService.java backend/src/test/java/com/lottopredictor/backend/auth/AuthServiceTest.java
git commit -m "Add user upsert-by-kakao-id logic"
```

---

### Task 6: `AuthController` (`/api/auth/kakao/login`, `/api/auth/me`)

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/KakaoLoginRequest.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/KakaoLoginResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/auth/MeResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/api/AuthController.java`

**Interfaces:**
- Consumes: `KakaoOAuthClient` (Task 4), `AuthService` (Task 5), `JwtService` (Task 2), `@AuthPrincipal` (Task 3)
- Produces: `POST /api/auth/kakao/login` (body `{code, redirectUri}` → `{token, nickname}`, 카카오 실패 시 400), `GET /api/auth/me` (`@AuthPrincipal` 필요, `{nickname}` 반환, 미인증 시 401)

이 코드베이스는 컨트롤러 자체를 직접 테스트하지 않는 컨벤션이다 (`StatsController`, `GenerateController` 모두 전용 테스트 파일 없음 — 서비스만 테스트). 이 태스크는 전체 빌드 통과로 검증하고, 실제 카카오 계정을 이용한 종단 간 확인은 Task 10 이후 사용자가 카카오 앱을 설정한 뒤 진행한다.

- [ ] **Step 1: 요청/응답 DTO 작성**

`backend/src/main/java/com/lottopredictor/backend/auth/KakaoLoginRequest.java`:

```java
package com.lottopredictor.backend.auth;

public record KakaoLoginRequest(String code, String redirectUri) {
}
```

`backend/src/main/java/com/lottopredictor/backend/auth/KakaoLoginResponse.java`:

```java
package com.lottopredictor.backend.auth;

public record KakaoLoginResponse(String token, String nickname) {
}
```

`backend/src/main/java/com/lottopredictor/backend/auth/MeResponse.java`:

```java
package com.lottopredictor.backend.auth;

public record MeResponse(String nickname) {
}
```

- [ ] **Step 2: `AuthController` 작성**

```java
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

    public AuthController(KakaoOAuthClient kakaoOAuthClient, AuthService authService, JwtService jwtService) {
        this.kakaoOAuthClient = kakaoOAuthClient;
        this.authService = authService;
        this.jwtService = jwtService;
    }

    @PostMapping("/api/auth/kakao/login")
    public ResponseEntity<KakaoLoginResponse> kakaoLogin(@RequestBody KakaoLoginRequest request) {
        try {
            String accessToken = kakaoOAuthClient.exchangeCodeForAccessToken(request.code(), request.redirectUri());
            KakaoUserInfo info = kakaoOAuthClient.fetchUserInfo(accessToken);
            User user = authService.loginOrRegister(info);
            String jwt = jwtService.issue(user.getId(), user.getNickname());
            return ResponseEntity.ok(new KakaoLoginResponse(jwt, user.getNickname()));
        } catch (KakaoAuthException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/api/auth/me")
    public MeResponse me(@AuthPrincipal AuthenticatedUser user) {
        return new MeResponse(user.nickname());
    }
}
```

- [ ] **Step 3: 전체 빌드 확인 (기존 테스트 포함 전부 통과)**

Run: `cd backend && ./gradlew build`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/auth/KakaoLoginRequest.java backend/src/main/java/com/lottopredictor/backend/auth/KakaoLoginResponse.java backend/src/main/java/com/lottopredictor/backend/auth/MeResponse.java backend/src/main/java/com/lottopredictor/backend/api/AuthController.java
git commit -m "Add Kakao login and me endpoints"
```

---

### Task 7: 프론트 `lib/auth.ts`

**Files:**
- Create: `frontend/lib/auth.ts`
- Test: `frontend/lib/auth.test.ts`

**Interfaces:**
- Produces: `getKakaoAuthorizeUrl(): string`, `interface KakaoLoginResult {token: string; nickname: string}`, `loginWithKakaoCode(code: string, redirectUri: string): Promise<KakaoLoginResult>`, `interface MeResult {nickname: string}`, `getMe(token: string): Promise<MeResult>`

`NEXT_PUBLIC_KAKAO_CLIENT_ID`/`NEXT_PUBLIC_KAKAO_REDIRECT_URI`는 함수 본문 안에서 읽어야 한다 (모듈 최상단 상수로 두면 `vi.stubEnv`로 테스트 시 값을 바꿀 수 없다).

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getKakaoAuthorizeUrl, loginWithKakaoCode, getMe } from "./auth";

describe("getKakaoAuthorizeUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_REDIRECT_URI", "http://localhost:3000/auth/kakao/callback");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the kakao authorize url with client id and redirect uri", () => {
    const url = getKakaoAuthorizeUrl();
    expect(url).toContain("https://kauth.kakao.com/oauth/authorize?");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("redirect_uri=" + encodeURIComponent("http://localhost:3000/auth/kakao/callback"));
    expect(url).toContain("response_type=code");
  });
});

describe("loginWithKakaoCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the token and nickname on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "jwt-abc", nickname: "홍길동" }),
      })
    );

    const result = await loginWithKakaoCode("auth-code", "http://localhost:3000/auth/kakao/callback");

    expect(result).toEqual({ token: "jwt-abc", nickname: "홍길동" });
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(
      loginWithKakaoCode("bad-code", "http://localhost:3000/auth/kakao/callback")
    ).rejects.toThrow("카카오 로그인에 실패했습니다.");
  });
});

describe("getMe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the nickname when the token is valid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nickname: "홍길동" }) }));

    const result = await getMe("jwt-abc");

    expect(result).toEqual({ nickname: "홍길동" });
  });

  it("throws when the token is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(getMe("bad-token")).rejects.toThrow("로그인 정보를 확인하지 못했습니다.");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/auth.test.ts`
Expected: FAIL (`./auth` 모듈이 아직 없음)

- [ ] **Step 3: `lib/auth.ts` 작성**

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export function getKakaoAuthorizeUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ?? "";
  const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

export interface KakaoLoginResult {
  token: string;
  nickname: string;
}

export async function loginWithKakaoCode(code: string, redirectUri: string): Promise<KakaoLoginResult> {
  const res = await fetch(`${API_BASE_URL}/api/auth/kakao/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri }),
  });
  if (!res.ok) {
    throw new Error("카카오 로그인에 실패했습니다.");
  }
  return res.json();
}

export interface MeResult {
  nickname: string;
}

export async function getMe(token: string): Promise<MeResult> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("로그인 정보를 확인하지 못했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd frontend && npx vitest run lib/auth.test.ts`
Expected: 6 tests passed

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/auth.ts frontend/lib/auth.test.ts
git commit -m "Add Kakao login API client functions"
```

---

### Task 8: `AuthContext` + 레이아웃 연결

**Files:**
- Create: `frontend/app/contexts/AuthContext.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: `loginWithKakaoCode`, `getMe`, `KakaoLoginResult`, `MeResult` (Task 7 — 이 태스크는 `getMe`만 사용)
- Produces: `AuthProvider({children}): JSX.Element`, `useAuth(): {auth: {token: string; nickname: string} | null; login(token: string, nickname: string): void; logout(): void}`

이 파일은 React 컴포넌트라 (Global Constraints에 적은 대로) 자동 테스트는 작성하지 않는다. 타입체크 + 브라우저 수동 확인으로 검증한다.

- [ ] **Step 1: `AuthContext.tsx` 작성**

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe } from "../../lib/auth";

interface AuthState {
  token: string;
  nickname: string;
}

interface AuthContextValue {
  auth: AuthState | null;
  login: (token: string, nickname: string) => void;
  logout: () => void;
}

const STORAGE_KEY = "lotaro_auth";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed: AuthState = JSON.parse(raw);
      getMe(parsed.token)
        .then(() => setAuth(parsed))
        .catch(() => localStorage.removeItem(STORAGE_KEY));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function login(token: string, nickname: string) {
    const next = { token, nickname };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  return <AuthContext.Provider value={{ auth, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: `layout.tsx`에서 `AuthProvider`로 감싸기**

`frontend/app/layout.tsx`의 import 목록에 추가:

```tsx
import { AuthProvider } from "./contexts/AuthContext";
```

`RootLayout`의 return 문을 다음으로 교체:

```tsx
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          <Nav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
```

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add frontend/app/contexts/AuthContext.tsx frontend/app/layout.tsx
git commit -m "Add AuthContext and wire it into the root layout"
```

---

### Task 9: 카카오 콜백 페이지

**Files:**
- Create: `frontend/app/auth/kakao/callback/page.tsx`
- Create: `frontend/app/auth/kakao/callback/KakaoCallbackContent.tsx`
- Create: `frontend/app/auth/kakao/callback/callback.module.css`

**Interfaces:**
- Consumes: `loginWithKakaoCode` (Task 7), `useAuth` (Task 8)

`useSearchParams`를 쓰는 컴포넌트는 Global Constraints에 적은 대로 `<Suspense>`로 감싸야 프로덕션 빌드가 통과한다. 그래서 `page.tsx`는 Suspense 껍데기만, 실제 로직은 `KakaoCallbackContent.tsx`에 둔다. React 컴포넌트라 자동 테스트는 작성하지 않고 타입체크 + 브라우저 수동 확인으로 검증한다.

- [ ] **Step 1: `callback.module.css` 작성**

```css
.page {
  max-width: 480px;
  margin: 0 auto;
  padding: 4rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.error {
  color: var(--text-secondary);
}

.homeLink {
  color: var(--accent);
  font-weight: 600;
}
```

- [ ] **Step 2: `KakaoCallbackContent.tsx` 작성**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithKakaoCode } from "../../../../lib/auth";
import { useAuth } from "../../../contexts/AuthContext";
import styles from "./callback.module.css";

export default function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const kakaoError = searchParams.get("error");
    if (kakaoError || !code) {
      setError("카카오 로그인이 취소되었거나 실패했습니다.");
      return;
    }

    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ?? "";
    loginWithKakaoCode(code, redirectUri)
      .then(({ token, nickname }) => {
        login(token, nickname);
        router.replace("/");
      })
      .catch(() => setError("카카오 로그인에 실패했습니다."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
        <a href="/" className={styles.homeLink}>
          홈으로 돌아가기
        </a>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <p>로그인 처리 중...</p>
    </div>
  );
}
```

- [ ] **Step 3: `page.tsx` 작성**

```tsx
"use client";

import { Suspense } from "react";
import KakaoCallbackContent from "./KakaoCallbackContent";

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={<p>로그인 처리 중...</p>}>
      <KakaoCallbackContent />
    </Suspense>
  );
}
```

- [ ] **Step 4: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add frontend/app/auth/kakao/callback/page.tsx frontend/app/auth/kakao/callback/KakaoCallbackContent.tsx frontend/app/auth/kakao/callback/callback.module.css
git commit -m "Add Kakao OAuth callback page"
```

---

### Task 10: `Nav.tsx` 로그인/로그아웃 UI + 종단 간 확인

**Files:**
- Modify: `frontend/app/components/Nav.tsx`
- Modify: `frontend/app/components/Nav.module.css`

**Interfaces:**
- Consumes: `useAuth` (Task 8), `getKakaoAuthorizeUrl` (Task 7)

- [ ] **Step 1: `Nav.module.css`에 스타일 추가**

`frontend/app/components/Nav.module.css` 끝에 추가:

```css
.authSection {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-left: 0.4rem;
}

.authNickname {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.logoutButton {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.logoutButton:hover {
  color: var(--foreground);
  background: var(--surface-hover);
}

.loginLink {
  margin-left: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent-foreground);
  background: var(--accent);
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  transition: background-color 0.15s ease;
}

.loginLink:hover {
  background: var(--accent-hover);
}
```

- [ ] **Step 2: `Nav.tsx` 전체를 다음으로 교체**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";
import { useAuth } from "../contexts/AuthContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/generate", label: "번호생성" },
  { href: "/stats", label: "통계" },
  { href: "/draws", label: "회차조회" },
  { href: "/collect", label: "수집하기" },
];

export default function Nav() {
  const pathname = usePathname();
  const { auth, logout } = useAuth();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandDot} />
        로타로
      </Link>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`${styles.link} ${pathname === link.href ? styles.linkActive : ""}`}
        >
          {link.label}
        </Link>
      ))}
      {auth ? (
        <div className={styles.authSection}>
          <span className={styles.authNickname}>{auth.nickname}님</span>
          <button type="button" className={styles.logoutButton} onClick={logout}>
            로그아웃
          </button>
        </div>
      ) : (
        <a href={getKakaoAuthorizeUrl()} className={styles.loginLink}>
          로그인
        </a>
      )}
    </nav>
  );
}
```

- [ ] **Step 3: 타입체크 + 전체 프론트 테스트**

Run: `cd frontend && npx tsc --noEmit && npm test`
Expected: 에러 없음, 모든 테스트 통과

- [ ] **Step 4: Commit**

```bash
git add frontend/app/components/Nav.tsx frontend/app/components/Nav.module.css
git commit -m "Show login/logout state in the nav bar"
```

- [ ] **Step 5: 브라우저 수동 확인 (로그인 전 상태만)**

로컬 dev 서버(`cd frontend && npm run dev`)를 켜고 홈에 접속해 Nav에 "로그인" 버튼이 보이는지, 클릭 시 카카오 인증 페이지로 이동하려고 시도하는지 확인한다 (`NEXT_PUBLIC_KAKAO_CLIENT_ID`가 로컬에 설정 안 돼 있으면 카카오 쪽에서 에러를 보여줄 수 있음 — 그 자체가 링크가 정상적으로 카카오로 향하고 있다는 증거).

- [ ] **Step 6: 종단 간 확인 (사용자 작업 필요)**

다음이 준비된 후에 실제 로그인이 되는지 확인한다:
1. 카카오 개발자센터에서 앱 생성 + REST API 키 발급 + Redirect URI 등록 (스펙의 "배포 관련" 섹션 참고)
2. 백엔드에 `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`(선택), `JWT_SECRET` 설정
3. 프론트에 `NEXT_PUBLIC_KAKAO_CLIENT_ID`, `NEXT_PUBLIC_KAKAO_REDIRECT_URI` 설정 (빌드 타임 반영이라 재배포 필요)

로그인 → 카카오 인증 → 콜백 → Nav에 닉네임 표시 → 새로고침해도 로그인 유지 → 로그아웃까지 전체 흐름을 눈으로 확인한다.
