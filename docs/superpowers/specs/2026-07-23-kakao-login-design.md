# 카카오 OAuth 로그인 설계

## 배경 및 목적

로타로(LottoPredictor)에 카카오 로그인을 추가한다. 이후 이어질 등급제/포인트 스펙의 기반이 되며, 이번 스펙에서 실제로 제한되는 기능은 (아직 미구현인) 타로 3장 조합 AI 분석뿐이다. 기존 통계/생성/타로/회차조회 기능은 로그인 여부와 무관하게 지금처럼 계속 자유롭게 사용 가능하다.

## 범위

**포함:**
- 카카오 OAuth 인가 코드 플로우를 통한 로그인/로그아웃
- JWT 기반 세션 유지 (백엔드-프론트 도메인이 분리되어 있으므로 쿠키 대신 헤더 방식 사용)
- 유저 정보 최소 저장 (카카오 ID, 닉네임)
- 향후 엔드포인트를 로그인 필수로 잠글 수 있는 재사용 가능한 인증 메커니즘

**제외 (다음 스펙 또는 이후 작업):**
- 등급제/포인트 시스템
- 타로 3장 조합 AI 분석 기능 자체 (엔드포인트 뼈대만 준비, 실제 AI 호출 로직은 없음)
- 리프레시 토큰, 다른 소셜 로그인 제공자
- 닉네임 변경, 프로필 이미지

## 아키텍처 & 데이터 흐름

1. 유저가 Nav의 "로그인" 클릭 → 카카오 인증 페이지(`https://kauth.kakao.com/oauth/authorize`)로 이동
2. 카카오 인증 완료 → 프론트 콜백 페이지 `/auth/kakao/callback?code=...`로 리다이렉트
3. 콜백 페이지가 인가 코드(`code`)를 백엔드 `POST /api/auth/kakao/login`으로 전달
4. 백엔드:
   - 카카오 토큰 엔드포인트에 `code`를 보내 카카오 액세스 토큰 교환
   - 카카오 사용자 정보 API로 카카오 ID + 닉네임 조회
   - `users` 테이블에서 `kakao_id` 기준 upsert (신규면 생성, 기존이면 닉네임 갱신 후 재사용)
   - JWT(30일 만료, HS256) 발급
   - `{token, nickname}` 응답
5. 프론트: 토큰+닉네임을 `AuthContext` 상태 + localStorage에 저장, 홈으로 리다이렉트
6. 이후 인증이 필요한 API 호출 시 `Authorization: Bearer <token>` 헤더 포함
7. 새로고침 시 localStorage에서 토큰 복원 → `GET /api/auth/me`로 유효성 재확인 (만료/변조면 자동 로그아웃 처리)
8. 로그아웃: 서버 상태 변경 없이 프론트 로컬 상태 + localStorage만 삭제 (JWT는 스테이트리스, 서버에 블랙리스트 없음)

## 백엔드 구성

새 패키지: `backend/src/main/java/com/lottopredictor/backend/auth/`

- **DB 마이그레이션** `db/migrations/0003_create_users.sql`
  ```sql
  create table if not exists users (
    id bigserial primary key,
    kakao_id bigint not null unique,
    nickname varchar(80) not null,
    created_at timestamptz not null default now()
  );
  ```
- **`User`** — 기존 `LottoDraw` 엔티티와 동일한 스타일의 평범한 JPA 엔티티 (`id`, `kakaoId`, `nickname`, `createdAt`)
- **`UserRepository`** — `JpaRepository<User, Long>` + `findByKakaoId(Long kakaoId)`
- **`KakaoOAuthClient`** — 기존 `RestClientConfig`가 제공하는 `RestClient.Builder`를 사용해:
  - `exchangeCodeForToken(String code, String redirectUri)` → 카카오 액세스 토큰 문자열
  - `fetchUserInfo(String kakaoAccessToken)` → `KakaoUserInfo(Long kakaoId, String nickname)`
- **`JwtService`** — `jjwt` 라이브러리(`jjwt-api`/`jjwt-impl`/`jjwt-jackson`, `build.gradle`에 추가) 기반:
  - `issue(Long userId, String nickname)` → JWT 문자열 (HS256, 30일 만료)
  - `parse(String token)` → 유효하면 클레임 반환, 변조/만료 시 예외
  - 시크릿은 `JWT_SECRET` 환경변수 (`application.properties`에 `jwt.secret=${JWT_SECRET}` 추가)
- **`AuthController`**
  - `POST /api/auth/kakao/login` — body `{code, redirectUri}` → 위 흐름 실행, `{token, nickname}` 반환. 카카오 교환/조회 실패 시 400
  - `GET /api/auth/me` — `@AuthPrincipal`로 검증된 유저의 `{nickname}` 반환
- **`@AuthPrincipal` 커스텀 인자 리졸버** (`AuthPrincipalArgumentResolver` + `@AuthPrincipal` 애노테이션, 기존 `WebConfig`의 `addArgumentResolvers`에 등록):
  - `Authorization: Bearer <token>` 헤더를 읽어 `JwtService.parse`로 검증
  - 컨트롤러 메서드 파라미터에 `@AuthPrincipal AuthenticatedUser user`를 추가하기만 하면 그 엔드포인트가 자동으로 로그인 필수가 됨 (헤더 없음/무효/만료 시 401)
  - Spring Security 없이 가벼운 방식 유지. 이후 타로 AI 분석 엔드포인트도 이 패턴 그대로 재사용

CORS는 기존 `WebConfig`가 `/api/**`에 대해 `FRONTEND_ORIGIN`을 이미 허용하고 있어 별도 변경 불필요 (POST/GET 메서드도 이미 허용됨).

## 프론트 구성

- **`lib/auth.ts`** (신규)
  - `getKakaoAuthorizeUrl()` — `NEXT_PUBLIC_KAKAO_CLIENT_ID`, `NEXT_PUBLIC_KAKAO_REDIRECT_URI` 사용해 인가 URL 생성
  - `loginWithKakaoCode(code: string, redirectUri: string): Promise<{token: string; nickname: string}>` — `POST /api/auth/kakao/login`
  - `getMe(token: string): Promise<{nickname: string}>` — `GET /api/auth/me`, 401이면 에러 throw
- **`app/contexts/AuthContext.tsx`** (신규) — React Context:
  - 상태: `{token, nickname} | null`
  - localStorage 키 `lotaro_auth`에 동기화
  - 마운트 시 localStorage 복원 → `getMe`로 검증, 실패하면 즉시 로그아웃 처리
  - `login(token, nickname)`, `logout()` 노출
- **`app/layout.tsx`** — `<Nav/>{children}`을 `<AuthProvider>`로 감싸기
- **`app/auth/kakao/callback/page.tsx`** (신규, client component) — `useSearchParams`로 `code` 읽기 → `loginWithKakaoCode` 호출 → 성공 시 `AuthContext.login` + 홈으로 `router.replace("/")`, 실패 시 에러 메시지 + 홈 링크 표시
- **`Nav.tsx`** — `useAuth()` 사용: 로그아웃 상태면 "로그인" 링크(카카오 인가 URL), 로그인 상태면 "`{닉네임}`님" + 로그아웃 버튼 표시

## 에러 처리

- 카카오 인증 취소/실패 (콜백에 `code` 없음, 또는 `error` 파라미터) → 콜백 페이지에 에러 메시지 + 홈 링크
- 백엔드에서 카카오 토큰 교환/사용자 정보 조회 실패 → 400, 콜백 페이지가 일반 에러 문구 표시
- JWT 만료/변조 → `/api/auth/me` 401 → 프론트가 자동으로 로그아웃 상태로 전환 (localStorage 삭제)
- 백엔드 설정 누락(예: `JWT_SECRET`, 카카오 키 미설정) → 500

## 테스트

- 백엔드:
  - `JwtServiceTest` — 발급 후 파싱 라운드트립 성공, 변조된 토큰 거부, 만료된 토큰 거부
  - `AuthPrincipalArgumentResolverTest` — 헤더 없음/형식 오류/유효 토큰 각각의 처리
  - 유저 upsert 로직 테스트 — 신규 `kakao_id`는 생성, 기존 `kakao_id` 재로그인 시 기존 row 재사용(중복 생성 안 됨)
- 프론트:
  - `AuthContext` — localStorage 동기화, `login`/`logout` 동작
  - `auth.ts` — URL 생성 로직, 성공/실패 응답 파싱 (fetch 모킹)

## 배포 관련 (사전 준비 필요, 사용자 작업)

- [Kakao Developers](https://developers.kakao.com)에서 앱 생성 → REST API 키 발급
- Redirect URI 등록: 운영 `https://<프론트 도메인>/auth/kakao/callback`, 로컬 `http://localhost:3000/auth/kakao/callback`
- 환경변수 추가:
  - 백엔드(Render): `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `JWT_SECRET`
  - 프론트(Vercel, 빌드 타임): `NEXT_PUBLIC_KAKAO_CLIENT_ID`, `NEXT_PUBLIC_KAKAO_REDIRECT_URI`
