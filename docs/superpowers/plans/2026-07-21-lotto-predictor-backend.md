# 로또 예측 웹앱 — Java 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **실행 기록:** 이 계획의 모든 태스크(Task 1~6)는 2026-07-21 세션에서 Claude가 직접 구현·테스트·검증·커밋까지 완료했다 (사용자 요청: "모든 코드는 너가 직접 작성하면돼"). Task 6 진행 중 동행복권 사이트가 리뉴얼되어 설계 문서가 가정한 크롤러 API가 죽어있는 것을 발견해 새 API로 재작성했다 — 자세한 내용은 Task 6 참고.

**Goal:** `backend/`에 Spring Boot(Gradle) 프로젝트를 만들고, `docs/superpowers/specs/2026-07-21-lotto-predictor-java-backend-mvp-design.md`에서 정의한 REST API(`/api/generate`, `/api/stats`, `/api/draws`, `/api/crawl`)를 동작하는 상태로 구현한다.

**Architecture:** Spring Boot(Java 21, Gradle) 단일 모듈. `draw`(JPA 엔티티/리포지토리), `generate`(가중 랜덤 샘플링 + 빈도 계산, 순수 로직), `crawler`(동행복권 파싱 + 순차 동기화, 순수 로직 + RestClient glue), `stats`(통계 glue), `api`(REST 컨트롤러), `config`(CORS) 패키지로 나눈다. DB는 Supabase Postgres에 JDBC로 직접 접속한다.

**Tech Stack:** Java 21, Spring Boot 4.1.0, Gradle(wrapper 포함), Spring Web MVC, Spring Data JPA, PostgreSQL JDBC 드라이버, JUnit5 + AssertJ + Mockito + Spring `MockRestServiceServer`.

## Global Constraints

- DB는 `lotto_draws` 테이블 하나 (draw_no PK) — upsert는 assigned-ID 엔티티에 대한 `repository.save()`가 내부적으로 merge를 수행해 자연스럽게 처리된다.
- 크롤러는 동행복권 `getLottoNumber` 조회 API만 사용 (스크래핑 금지), 개별 회차 실패는 건너뛰고 계속 진행, 무한 루프 방지를 위한 `maxAttempts` 상한(기본 200) 포함.
- `/api/crawl`은 `Authorization: Bearer <secret>` 헤더로 보호, 시크릿은 `lotto.crawl-secret` 프로퍼티(env `CRAWL_SECRET`)에서 읽는다.
- 번호 생성은 가중 비복원 샘플링이 기본, `mode=random` 완전 랜덤 옵션 제공, DB가 비어있으면 자동으로 랜덤 모드 폴백.
- 가중 랜덤 로직은 특정 번호에 가중치를 높였을 때 실제로 더 자주 뽑히는지 단위 테스트로 검증.
- 크롤러 파서/클라이언트는 모킹된 응답(성공/실패/HTTP 에러)으로 단위 테스트.
- 프론트엔드는 DB에 직접 접근하지 않고 이 REST API만 호출한다 (CORS로 프론트 도메인 허용).
- 자동 스케줄링 크론 없음 — 크롤링은 `/api/crawl` 수동 호출로만 트리거된다.

---

## File Structure

```
backend/
├── build.gradle, settings.gradle, gradlew(.bat), gradle/wrapper/
├── src/main/java/com/lottopredictor/backend/
│   ├── BackendApplication.java
│   ├── draw/
│   │   ├── LottoDraw.java              # JPA 엔티티
│   │   └── LottoDrawRepository.java    # findMaxDrawNo, findByDrawDate, findAllByOrderByDrawNoDesc(Pageable)
│   ├── generate/
│   │   ├── NumberWeight.java           # record(number, weight)
│   │   ├── WeightedRandomSampler.java  # 가중/균등 비복원 샘플링 (순수 함수)
│   │   ├── FrequencyCalculator.java    # 출현 빈도 계산 (순수 함수)
│   │   ├── GenerateResult.java         # record(mode, results)
│   │   └── NumberGenerationService.java
│   ├── crawler/
│   │   ├── DhLotteryResponse.java      # API 응답 DTO
│   │   ├── LottoDrawData.java          # 파싱된 순수 데이터
│   │   ├── FetchDrawResult.java        # sealed interface: Success/NotDrawnYet/Error
│   │   ├── SkippedDraw.java, SyncResult.java
│   │   ├── DhLotteryResponseParser.java
│   │   ├── DhLotteryClient.java        # RestClient로 외부 API 호출
│   │   ├── CrawlSyncService.java       # 순차 동기화 루프 (순수 로직, 의존성 주입)
│   │   └── LottoCrawlerService.java    # 실제 Repository/Client를 연결하는 glue
│   ├── stats/
│   │   ├── NumberStat.java             # record(number, count, percentage)
│   │   └── StatsService.java
│   ├── api/
│   │   ├── GenerateController.java     # GET /api/generate
│   │   ├── StatsController.java        # GET /api/stats
│   │   ├── DrawResponse.java, DrawController.java  # GET /api/draws
│   │   └── CrawlController.java        # POST /api/crawl (Bearer 시크릿)
│   └── config/WebConfig.java           # CORS
├── src/main/resources/
│   ├── application.properties          # env var 기반 설정
│   └── application-local.properties.example
└── src/test/java/com/lottopredictor/backend/
    ├── generate/ (WeightedRandomSamplerTest, FrequencyCalculatorTest, NumberGenerationServiceTest)
    └── crawler/ (DhLotteryResponseParserTest, DhLotteryClientTest, CrawlSyncServiceTest)
```

---

## Task 1: 프로젝트 스캐폴딩

**Files:** `backend/` 전체 (Spring Initializr 생성 + HELP.md 제거)

- [x] **Step 1:** Spring Initializr로 프로젝트 생성

```bash
curl -s "https://start.spring.io/starter.zip?type=gradle-project&language=java&javaVersion=21&groupId=com.lottopredictor&artifactId=backend&name=backend&packageName=com.lottopredictor.backend&dependencies=web,data-jpa,postgresql" -o backend.zip
mkdir -p backend && unzip -q backend.zip -d backend && rm backend.zip
```

- [x] **Step 2:** `HELP.md` 삭제, `./gradlew build -x test`로 스캐폴딩이 빌드되는지 확인 (Gradle 9.5.1 자동 다운로드, BUILD SUCCESSFUL 확인).
- [x] **Step 3:** 커밋 (`Scaffold Spring Boot backend project via Spring Initializr`).

---

## Task 2: `lotto_draws` 엔티티 + 리포지토리

**Files:** `draw/LottoDraw.java`, `draw/LottoDrawRepository.java`

**Interfaces:**
- Produces: `LottoDraw(Integer drawNo, LocalDate drawDate, Integer num1..6, Integer bonusNum)`, `int[] numbers()`. `LottoDrawRepository extends JpaRepository<LottoDraw, Integer>`에 `findMaxDrawNo()`, `findByDrawDate(LocalDate)`, `findAllByOrderByDrawNoDesc(Pageable)`.

- [x] **Step 1:** 엔티티에 `db/migrations/0001_create_lotto_draws.sql`과 동일한 컬럼 매핑 (draw_no PK, num1~6, bonus_num, created_at은 DB 기본값에 위임하도록 `insertable=false, updatable=false`).
- [x] **Step 2:** 리포지토리에 `@Query("select max(d.drawNo) from LottoDraw d")`로 최신 회차 조회 메서드 추가. (`save()`가 assigned-ID 엔티티에 대해 merge를 수행하므로 별도 upsert 쿼리는 불필요 — 존재하지 않는 ID는 insert, 존재하면 update.)
- [x] **Step 3:** `./gradlew compileJava`로 컴파일 확인.

---

## Task 3: 번호 생성 로직 (가중 랜덤 샘플링 + 빈도 계산)

**Files:** `generate/NumberWeight.java`, `generate/WeightedRandomSampler.java` (+ test), `generate/FrequencyCalculator.java` (+ test), `generate/GenerateResult.java`, `generate/NumberGenerationService.java` (+ test)

**Interfaces:**
- Produces: `WeightedRandomSampler.weightedSampleWithoutReplacement(List<NumberWeight>, int, DoubleSupplier)`, `.uniformSampleWithoutReplacement(int, int, DoubleSupplier)`; `FrequencyCalculator.calculate(List<int[]>): List<NumberWeight>`; `NumberGenerationService.generate(String mode, int sets): GenerateResult`.
- Consumes: `LottoDrawRepository` (Task 2), `LottoDraw.numbers()`.

- [x] **Step 1:** `WeightedRandomSamplerTest` 작성 (균등 샘플링의 범위/중복없음, 고정 rng로 결정론적 결과, 가중치 높은 번호가 500회 시행 중 90% 이상 뽑히는지, 전부 가중치 0일 때 균등 폴백) → 5개 테스트.
- [x] **Step 2:** `WeightedRandomSampler` 구현 (비복원 룰렛휠 선택, `DoubleSupplier rng` 주입으로 테스트 가능하게).
- [x] **Step 3:** `FrequencyCalculatorTest` 작성 (빈 목록이면 전부 0, 여러 회차에서 번호별 등장 횟수 집계) → 2개 테스트.
- [x] **Step 4:** `FrequencyCalculator` 구현.
- [x] **Step 5:** `NumberGenerationServiceTest` 작성 (Mockito로 `LottoDrawRepository` 목킹 — DB 비어있으면 랜덤 폴백, 데이터 있으면 weighted 유지, 세트 수만큼 생성되고 각 세트가 오름차순 정렬) → 3개 테스트.
- [x] **Step 6:** `NumberGenerationService` 구현 (`@Service`, repository에서 읽은 draw를 `int[]`로 변환 후 `FrequencyCalculator`/`WeightedRandomSampler` 조합).
- [x] **Step 7:** `./gradlew test --tests "com.lottopredictor.backend.generate.*"` → BUILD SUCCESSFUL (10 tests).
- [x] **Step 8:** 커밋 (다른 태스크와 함께 일괄 커밋됨 — 아래 Task 5 참고).

---

## Task 4: 크롤러 (파서 + HTTP 클라이언트 + 동기화 루프)

**Files:** `crawler/DhLotteryResponse.java`, `crawler/LottoDrawData.java`, `crawler/FetchDrawResult.java`, `crawler/DhLotteryResponseParser.java` (+ test), `crawler/DhLotteryClient.java` (+ test), `crawler/SkippedDraw.java`, `crawler/SyncResult.java`, `crawler/CrawlSyncService.java` (+ test), `crawler/LottoCrawlerService.java`

**Interfaces:**
- Produces: `DhLotteryResponseParser.parse(DhLotteryResponse): LottoDrawData`(nullable); `DhLotteryClient.fetchDraw(int): FetchDrawResult`; `CrawlSyncService.sync(IntSupplier, IntFunction<FetchDrawResult>, Consumer<LottoDrawData>[, int maxAttempts]): SyncResult`; `LottoCrawlerService.syncLatestDraws(): SyncResult`.
- Consumes: `LottoDrawRepository`(Task 2), `RestClient.Builder`(Spring 자동 주입).

- [x] **Step 1:** `DhLotteryResponseParserTest` 작성 (정상 파싱, `returnValue=fail`이면 null, 필수 필드 누락이면 null) → 3개 테스트.
- [x] **Step 2:** `DhLotteryResponseParser` 구현.
- [x] **Step 3:** `DhLotteryClientTest` 작성 (`MockRestServiceServer.bindTo(RestClient.Builder)`로 성공/실패(fail)/HTTP 500 응답 모킹) → 3개 테스트.
- [x] **Step 4:** `DhLotteryClient` 구현 (`RestClient`로 `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={n}` 호출, 예외는 `Error`로 변환).
- [x] **Step 5:** `CrawlSyncServiceTest` 작성 (latest+1부터 순차 조회 후 not-drawn-yet에서 정지, 에러난 회차는 건너뛰고 계속, `maxAttempts`로 무한루프 방지) → 3개 테스트.
- [x] **Step 6:** `CrawlSyncService` 구현 (순수 함수, `IntSupplier`/`IntFunction`/`Consumer` 의존성 주입 — TS 버전 `sync.ts`와 동일한 구조).
- [x] **Step 7:** `LottoCrawlerService` 구현 (`@Service`, 실제 `LottoDrawRepository`/`DhLotteryClient`를 `CrawlSyncService.sync(...)`에 연결하는 glue, 테스트 없음 — DB 연동은 Task 6에서 수동 검증).
- [x] **Step 8:** `./gradlew test --tests "com.lottopredictor.backend.crawler.*"` → BUILD SUCCESSFUL (9 tests).

---

## Task 5: REST API + CORS + 설정

**Files:** `stats/NumberStat.java`, `stats/StatsService.java`, `api/GenerateController.java`, `api/StatsController.java`, `api/DrawResponse.java`, `api/DrawController.java`, `api/CrawlController.java`, `config/WebConfig.java`, `src/main/resources/application.properties`, `application-local.properties.example`, `.gitignore`

**Interfaces:**
- Consumes: `NumberGenerationService`(Task 3), `LottoCrawlerService`(Task 4), `LottoDrawRepository`(Task 2), `StatsService`.
- Produces: `GET /api/generate?mode=weighted|random&sets=1..10`, `GET /api/stats`, `GET /api/draws?drawNo=&date=&page=&size=`, `POST /api/crawl`(`Authorization: Bearer <secret>`).

- [x] **Step 1:** `StatsService` 구현 — `FrequencyCalculator` 재사용해 번호별 등장 횟수 + `count/totalDraws*100` 퍼센트 계산.
- [x] **Step 2:** `GenerateController` — `mode`/`sets`(1~10 clamp) 쿼리 파라미터를 `NumberGenerationService.generate(...)`에 위임.
- [x] **Step 3:** `StatsController` — `GET /api/stats`가 `List<NumberStat>` 반환.
- [x] **Step 4:** `DrawResponse`/`DrawController` — `drawNo`로 단건 조회, `date`로 검색, 둘 다 없으면 `page`/`size` 페이지네이션(`PageRequest`) 목록.
- [x] **Step 5:** `CrawlController` — `@Value("${lotto.crawl-secret}")` 주입, `Authorization` 헤더가 `"Bearer " + secret`과 정확히 일치하지 않으면 401, 일치하면 `LottoCrawlerService.syncLatestDraws()` 호출.
- [x] **Step 6:** `WebConfig` — `lotto.frontend-origin`(콤마 구분, env `FRONTEND_ORIGIN`, 기본값 `http://localhost:3000`)을 `/api/**`에 대해 CORS 허용.
- [x] **Step 7:** `application.properties`에 env 기반 설정 추가 (`SUPABASE_JDBC_URL`/`SUPABASE_DB_USERNAME`/`SUPABASE_DB_PASSWORD`/`CRAWL_SECRET`/`FRONTEND_ORIGIN`/`PORT`), `spring.jpa.hibernate.ddl-auto=validate`(스키마는 수동 마이그레이션으로 이미 존재한다고 가정).
- [x] **Step 8:** 로컬 개발용 `application-local.properties.example` 작성 (실제 값 채운 `application-local.properties`는 `.gitignore`에 추가해 커밋 방지).
- [x] **Step 9:** 기본 생성된 `BackendApplicationTests.contextLoads()` 삭제 — 실제 DB 연결 없이는 Spring 컨텍스트가 뜨지 않아 `./gradlew test`가 항상 실패하게 되므로, 설계 문서의 테스트 범위(가중 랜덤 로직 + 크롤러 파서)에 맞춰 제거.
- [x] **Step 10:** `./gradlew build` 전체 실행 → BUILD SUCCESSFUL, 19 tests 전부 통과.
- [x] **Step 11:** 커밋 (`Implement backend: draws entity, weighted number generation, crawler, REST API`).

---

## Task 6: 수동 검증 (Supabase 연동 후) — 완료

- [x] **Step 1:** Supabase 프로젝트 생성(`LottoPredictor`, Asia-Pacific, Data API 자동노출 해제), SQL Editor에서 마이그레이션 실행.
- [x] **Step 2:** Session pooler(IPv4 호환) + JDBC 연결 문자열/사용자명/비밀번호 확인.
- [x] **Step 3:** `application-local.properties` 생성 (JDBC URL에 자격증명을 넣지 않고 `spring.datasource.username`/`password`로 분리 — 비밀번호에 `!@#` 같은 특수문자가 있으면 URL 쿼리 파라미터에선 percent-encoding이 필요해 오류가 나기 쉽다).
- [x] **Step 4:** `SPRING_PROFILES_ACTIVE=local ./gradlew bootRun`으로 로컬 실행.
- [x] **Step 5:** curl로 각 엔드포인트 확인 (아래는 실제로 마주친 이슈와 함께 정리):

**진행 중 발견한 이슈 3가지 (전부 수정하고 커밋함, `fbf16d2`):**

1. **`lotto_draws` 컬럼 타입 불일치** — 마이그레이션이 `smallint`로 만들었는데 JPA 엔티티는 `Integer`라 Hibernate `ddl-auto=validate`가 기동을 막았다. DB 컬럼을 `integer`로 ALTER해서 해결 (마이그레이션 파일도 `integer`로 수정).
2. **`RestClient.Builder` 빈 없음** — Spring Boot 4.1.0 + `spring-boot-starter-webmvc` 조합에서는 `RestClient.Builder`가 자동 등록되지 않는다. `config/RestClientConfig.java`에 명시적 `@Bean`으로 등록.
3. **동행복권 크롤러 API 자체가 죽어있었음** — 설계 문서가 가정한 `common.do?method=getLottoNumber&drwNo=N`이 302로 홈페이지로 리다이렉트되고, `gameResult.do`는 404. **사이트가 SPA로 전면 개편되면서 옛 API가 통째로 사라졌다.** 브라우저로 `/lt645/result` 페이지의 네트워크 요청을 직접 관찰해서 새 API를 찾음:

   `GET https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd={회차}`

   - 세션/쿠키 불필요 (순수 curl로도 동작 확인).
   - 응답은 `{"data":{"list":[{...최대 10개 회차...}]}}` 형태 — 요청한 회차를 반드시 포함하지만 **목록의 첫 번째 항목이 아닐 수 있다** (예: `srchLtEpsd=1`은 1~10회차 목록을 반환하며 1은 마지막 항목). 그래서 파서는 `list[0]`을 쓰지 않고 `ltEpsd == 요청한 회차`인 항목을 찾아야 한다.
   - 필드명도 전부 바뀌었다: `drwNo`→`ltEpsd`, `drwNoDate`(`yyyy-MM-dd`)→`ltRflYmd`(`yyyyMMdd`, 구분자 없음), `drwtNo1..6`→`tm1WnNo..tm6WnNo`, `bnusNo`→`bnsWnNo`.
   - "아직 추첨 안 됨" 신호도 바뀌었다: 예전엔 `returnValue:"fail"`이었는데, 새 API는 그냥 `list`가 비어있거나(미래 회차) 요청한 회차가 목록에 없는 것으로 표현된다. `resultCode`/`resultMessage`는 관찰한 모든 케이스에서 `null`이었다.
   - `lib/lotto/crawler.ts`(TS 버전, 이제 사용 안 함)와 Java 버전 둘 다 원래 옛 API를 가정하고 작성했었다. Java 쪽만 새 API에 맞게 다시 작성(`DhLotteryResponse`, `DhLotteryDrawEntry`, `DhLotteryResponseParser`, `DhLotteryClient`와 테스트).

**실제 실행 결과:**

```bash
curl "http://localhost:8080/api/generate?mode=random&sets=2"
# {"mode":"random","results":[[...6개 숫자],[...6개 숫자]]}

curl -i -X POST "http://localhost:8080/api/crawl"
# 401 (Authorization 헤더 없음 — 처음엔 400이 나오는 버그가 있었는데 @RequestHeader를 required=false로 고쳐서 401로 정정)

curl -i -X POST -H "Authorization: Bearer <crawl-secret>" "http://localhost:8080/api/crawl"
# 200, 1회 호출당 최대 200개 회차까지 동기화(maxAttempts 상한). 6번 반복 호출해서 1~1233회차 전체 백필 완료.
# 이미 최신 상태에서 다시 호출하면 {"synced":[],"skipped":[]} — 멱등성 확인.

curl "http://localhost:8080/api/stats"
# 실제 1233개 회차 기준 번호별 count/percentage (예: 1번 169회, 13.7%)

curl "http://localhost:8080/api/draws?drawNo=1"
# [{"drawNo":1,"drawDate":"2002-12-07","numbers":[10,23,29,33,37,40],"bonusNum":16}]

curl "http://localhost:8080/api/generate?mode=weighted&sets=2"
# "mode":"weighted" — DB에 데이터가 있으니 더 이상 랜덤 폴백되지 않음
```

- [x] **Step 6:** 두 번째 이후 `/api/crawl` 호출이 안전한지 확인 (새 회차가 없으면 `synced: []`로 아무 일도 안 일어남) — 위에서 확인 완료.
