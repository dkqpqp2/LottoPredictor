# 타로 AI 종합 해석 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/tarot` 페이지를 3모드(타로만 보기 / 별자리 함께보기 / 번호 뽑기용 타로)로 재편하고, 앞의 두 모드에 Claude 기반 AI 종합 해석 기능을 추가한다.

**Architecture:** 백엔드에 새 패키지 `tarotinterpretation`을 만들어 Anthropic Java SDK로 Claude Sonnet 5를 호출하고 결과를 DB에 저장한다. 기존 `Feature.TAROT`(하루 1회, 전 등급 공통) 횟수 풀을 그대로 재사용해 AI 해석 횟수를 제한하고, 신규 "번호 뽑기용 타로" 모드는 기존 `Feature.GENERATE`(등급별) 풀을 공유한다. 프론트엔드는 `/tarot` 페이지를 재작성해 세 모드를 하나의 상태 머신으로 관리한다.

**Tech Stack:** Java 21 / Spring Boot 4.1 / Anthropic Java SDK(`com.anthropic:anthropic-java`) / Postgres(Supabase) / Next.js 16 App Router / TypeScript / Vitest

## Global Constraints

- AI 해석은 `TAROT_ONLY`(3장 스프레드)와 `WITH_ZODIAC`(1장+별자리) 두 모드에서만 제공하며, 하루 1회 `Feature.TAROT` 풀을 공유한다 (전 등급 동일, 기존 `TierPolicy` 값 그대로 재사용 — 코드 변경 없음).
- 신규 "번호 뽑기용 타로" 모드는 AI를 쓰지 않고 카드 가중치로 클라이언트에서 번호를 계산하며, 하루 횟수는 `Feature.GENERATE` 풀을 공유한다 (등급별 1/3/5/무제한 + `maxSets`, 기존 `TierPolicy` 값 그대로 재사용).
- AI 호출에 사용할 모델은 정확히 `claude-sonnet-5` (문자열 그대로 사용, 별칭/버전 임의 변경 금지).
- 해석 텍스트는 한국어로 3~5문장, 따뜻하고 재미로 참고하는 톤 (점술적 확언 금지).
- AI 호출이 실패하면 그 요청에서 소모된 `Feature.TAROT` 횟수는 원복되어야 한다 (`@Transactional` 롤백으로 보장).
- 카드 공개(드래그로 뒤집기)와 리셋/리셔플은 계속 무료·무제한이며, 횟수는 정확히 "종합 해석 보기" 클릭과 "번호 뽑기" 클릭 두 지점에서만 소모된다.
- API 키는 환경변수 `ANTHROPIC_API_KEY`로 관리한다 (`anthropic.api-key` 프로퍼티로 주입).
- 새 DB 마이그레이션은 배포 전에 Supabase에 수동으로 먼저 적용해야 한다 (`db/migrations/README.md` 기존 규칙 — `spring.jpa.hibernate.ddl-auto=validate`라 순서를 어기면 백엔드 전체가 기동 실패한다).

---

### Task 1: DB 마이그레이션 + `TarotInterpretation` 엔티티 + Repository

**Files:**
- Create: `db/migrations/0009_create_tarot_interpretations.sql`
- Create: `backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretation.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationRepository.java`

**Interfaces:**
- Produces: `TarotInterpretation` 엔티티(생성자 `TarotInterpretation(Long userId, String mode, String cardsJson, String zodiac, String interpretationText, Instant createdAt)`, getter `getId()/getUserId()/getMode()/getCardsJson()/getZodiac()/getInterpretationText()/getCreatedAt()`), `TarotInterpretationRepository.findByUserIdOrderByCreatedAtDesc(Long userId): List<TarotInterpretation>` — 이후 모든 태스크가 이 타입들을 그대로 사용한다.

이 태스크는 순수 데이터 클래스/마이그레이션이라 별도 유닛 테스트 없이 진행한다 (기존 `SavedNumber` 엔티티도 동일하게 전용 테스트가 없다 — `SavedNumberServiceTest`에서 간접적으로만 검증됨).

- [ ] **Step 1: 마이그레이션 SQL 작성**

`db/migrations/0009_create_tarot_interpretations.sql`:

```sql
create table if not exists tarot_interpretations (
  id bigserial primary key,
  user_id bigint not null references users(id),
  mode varchar(20) not null,
  cards_json text not null,
  zodiac varchar(20),
  interpretation_text text not null,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: 엔티티 작성**

`backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretation.java`:

```java
package com.lottopredictor.backend.tarotinterpretation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "tarot_interpretations")
public class TarotInterpretation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String mode;

    @Column(name = "cards_json", nullable = false, columnDefinition = "text")
    private String cardsJson;

    @Column
    private String zodiac;

    @Column(name = "interpretation_text", nullable = false, columnDefinition = "text")
    private String interpretationText;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TarotInterpretation() {
    }

    public TarotInterpretation(
            Long userId,
            String mode,
            String cardsJson,
            String zodiac,
            String interpretationText,
            Instant createdAt
    ) {
        this.userId = userId;
        this.mode = mode;
        this.cardsJson = cardsJson;
        this.zodiac = zodiac;
        this.interpretationText = interpretationText;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getMode() {
        return mode;
    }

    public String getCardsJson() {
        return cardsJson;
    }

    public String getZodiac() {
        return zodiac;
    }

    public String getInterpretationText() {
        return interpretationText;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
```

- [ ] **Step 3: Repository 작성**

`backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationRepository.java`:

```java
package com.lottopredictor.backend.tarotinterpretation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TarotInterpretationRepository extends JpaRepository<TarotInterpretation, Long> {

    List<TarotInterpretation> findByUserIdOrderByCreatedAtDesc(Long userId);
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0009_create_tarot_interpretations.sql backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretation.java backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationRepository.java
git commit -m "Add tarot_interpretations table and entity"
```

---

### Task 2: 요청/응답 DTO + 예외 클래스

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationRequest.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationFailedException.java`

**Interfaces:**
- Consumes: 없음 (Task 1의 패키지 위치만 공유)
- Produces: `TarotInterpretationRequest(String mode, List<CardInput> cards, String zodiacName)`와 중첩 레코드 `TarotInterpretationRequest.CardInput(int cardNumber, String nameKo, String keyword, String direction, String positionLabel)`; `TarotInterpretationResponse(Long id, String mode, List<TarotInterpretationRequest.CardInput> cards, String zodiacName, String interpretationText, Instant createdAt)`; `TarotInterpretationFailedException(String message, Throwable cause)` (`RuntimeException` 서브클래스) — Task 3~5가 이 타입들을 그대로 사용한다.

순수 데이터/예외 클래스라 별도 테스트 없이 진행한다 (기존 `SaveNumberRequest`/`SavedNumberResponse`도 전용 테스트가 없다).

- [ ] **Step 1: 요청 DTO 작성**

`backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationRequest.java`:

```java
package com.lottopredictor.backend.tarotinterpretation;

import java.util.List;

public record TarotInterpretationRequest(String mode, List<CardInput> cards, String zodiacName) {

    public record CardInput(int cardNumber, String nameKo, String keyword, String direction, String positionLabel) {
    }
}
```

- [ ] **Step 2: 응답 DTO 작성**

`backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationResponse.java`:

```java
package com.lottopredictor.backend.tarotinterpretation;

import java.time.Instant;
import java.util.List;

public record TarotInterpretationResponse(
        Long id,
        String mode,
        List<TarotInterpretationRequest.CardInput> cards,
        String zodiacName,
        String interpretationText,
        Instant createdAt
) {
}
```

- [ ] **Step 3: 예외 클래스 작성**

`backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationFailedException.java`:

```java
package com.lottopredictor.backend.tarotinterpretation;

public class TarotInterpretationFailedException extends RuntimeException {

    public TarotInterpretationFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationRequest.java backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationResponse.java backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationFailedException.java
git commit -m "Add tarot interpretation request/response DTOs and failure exception"
```

---

### Task 3: `ClaudeTarotInterpreter` (Anthropic Java SDK 연동)

**Files:**
- Modify: `backend/build.gradle`
- Create: `backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/ClaudeTarotInterpreter.java`
- Modify: `backend/src/main/resources/application.properties`
- Modify: `backend/src/main/resources/application-local.properties.example`

**Interfaces:**
- Consumes: 없음
- Produces: `ClaudeTarotInterpreter.interpret(String userPrompt): String` — 성공 시 해석 텍스트, 실패 시 `TarotInterpretationFailedException`(Task 2)을 던진다. Task 4가 이 메서드를 사용한다.

**⚠️ 중요 — API 서명 불확실성:** 이 태스크는 Anthropic Java SDK(`com.anthropic:anthropic-java`)를 처음 이 프로젝트에 도입한다. 아래 코드는 SDK 공식 문서(`claude-api` 스킬의 `java/claude-api/README.md`)에 나온 패턴을 그대로 옮긴 것이지만, `Model.of(String)`처럼 정확한 존재 여부를 소스 없이 100% 확신할 수 없는 호출이 섞여 있다. **`./gradlew compileJava`를 돌려보고 컴파일 에러가 나면, 에러 메시지가 가리키는 클래스를 `javap -classpath <anthropic-java jar 경로> com.anthropic.models.messages.Model`(또는 `MessageCreateParams.Builder`) 등으로 직접 조회해서 올바른 멤버로 고쳐라.** 이 방식은 `claude-api` 스킬이 문서화한 "컴파일 에러로 정확한 멤버를 찾는" 표준 절차다. jar 경로는 `./gradlew dependencies --configuration compileClasspath | grep anthropic-java` 또는 `find ~/.gradle/caches -name "anthropic-java-*.jar"`로 찾을 수 있다.

이 클래스는 실제 외부 API를 호출하는 얇은 래퍼라 자동화 테스트를 추가하지 않는다 (기존 `KakaoOAuthClient`와 달리 Anthropic SDK는 `RestClient` 기반이 아니라서 프로젝트가 이미 쓰는 `MockRestServiceServer`로 목 처리할 수 없고, 이를 위해 새 테스트 의존성을 들이는 건 이 기능의 스코프를 벗어난다). 정상 동작은 Task 8/9의 브라우저 수동 검증에서 확인하고, 이 클래스를 사용하는 `TarotInterpretationService`는 Task 4에서 Mockito로 완전히 목 처리해 테스트한다.

- [ ] **Step 1: build.gradle에 의존성 추가**

`backend/build.gradle`의 `dependencies` 블록에 추가 (postgresql 줄 바로 아래):

```groovy
	implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
	implementation 'org.springframework.boot:spring-boot-starter-webmvc'
	runtimeOnly 'org.postgresql:postgresql'
	implementation 'com.anthropic:anthropic-java:2.34.0'
	implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
```

- [ ] **Step 2: application.properties에 설정 추가**

`backend/src/main/resources/application.properties` 끝에 추가:

```properties
anthropic.api-key=${ANTHROPIC_API_KEY}
```

- [ ] **Step 3: 로컬 예시 파일에 항목 추가**

`backend/src/main/resources/application-local.properties.example` 끝에 추가:

```properties
anthropic.api-key=<Anthropic 콘솔에서 발급받은 API 키>
```

- [ ] **Step 4: ClaudeTarotInterpreter 작성**

`backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/ClaudeTarotInterpreter.java`:

```java
package com.lottopredictor.backend.tarotinterpretation;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class ClaudeTarotInterpreter {

    private static final String MODEL_ID = "claude-sonnet-5";
    private static final long MAX_TOKENS = 512L;

    private static final String SYSTEM_PROMPT = """
            너는 따뜻하고 공감가는 톤으로 타로를 해석해주는 상담사야. 사용자가 뽑은 카드 정보를 받아서, \
            그 카드들을 하나의 자연스러운 이야기로 엮은 3~5문장짜리 한 단락의 해석을 한국어로 작성해. \
            점술적으로 확정적인 예언처럼 말하지 말고, 가볍게 참고할 수 있는 재미있는 조언 톤을 유지해. \
            해석 내용 외의 다른 말(인사, 부연설명, 마크다운 기호)은 절대 덧붙이지 마.
            """;

    private final AnthropicClient client;

    public ClaudeTarotInterpreter(@Value("${anthropic.api-key}") String apiKey) {
        this.client = AnthropicOkHttpClient.builder().apiKey(apiKey).build();
    }

    public String interpret(String userPrompt) {
        MessageCreateParams params = MessageCreateParams.builder()
                .model(Model.of(MODEL_ID))
                .maxTokens(MAX_TOKENS)
                .system(SYSTEM_PROMPT)
                .addUserMessage(userPrompt)
                .build();

        Message response;
        try {
            response = client.messages().create(params);
        } catch (RuntimeException e) {
            throw new TarotInterpretationFailedException(
                    "failed to call Claude for tarot interpretation: " + e.getMessage(), e
            );
        }

        String text = response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(t -> t.text())
                .collect(Collectors.joining());

        if (text.isBlank()) {
            throw new TarotInterpretationFailedException("Claude returned an empty interpretation", null);
        }
        return text;
    }
}
```

- [ ] **Step 5: 컴파일 확인 (Step 0의 안내에 따라 필요시 수정)**

Run: `cd backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL (실패 시 위 "⚠️ 중요" 안내대로 `javap`로 정확한 멤버를 찾아 수정)

- [ ] **Step 6: Commit**

```bash
git add backend/build.gradle backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/ClaudeTarotInterpreter.java backend/src/main/resources/application.properties backend/src/main/resources/application-local.properties.example
git commit -m "Add Claude-backed tarot interpreter"
```

---

### Task 4: `TarotInterpretationService` (+ 테스트)

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationServiceTest.java`

**Interfaces:**
- Consumes: `TarotInterpretationRepository`(Task 1), `TarotInterpretationRequest`/`Response`/`FailedException`(Task 2), `ClaudeTarotInterpreter.interpret(String): String`(Task 3), `UsageService.consume(Long userId, Feature feature): boolean`(기존, `com.lottopredictor.backend.progress.UsageService`), `Feature.TAROT`(기존, `com.lottopredictor.backend.progress.Feature`)
- Produces: `TarotInterpretationService.interpret(Long userId, TarotInterpretationRequest request): Optional<TarotInterpretationResponse>` (빈 Optional = 횟수 소진, 예외 = AI 호출 실패), `TarotInterpretationService.getHistory(Long userId): List<TarotInterpretationResponse>` — Task 5가 이 두 메서드를 그대로 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationServiceTest.java`:

```java
package com.lottopredictor.backend.tarotinterpretation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.UsageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TarotInterpretationServiceTest {

    @Mock
    private TarotInterpretationRepository repository;

    @Mock
    private UsageService usageService;

    @Mock
    private ClaudeTarotInterpreter interpreter;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private TarotInterpretationRequest sampleRequest() {
        return new TarotInterpretationRequest(
                "WITH_ZODIAC",
                List.of(new TarotInterpretationRequest.CardInput(0, "바보", "새로운 시작", "up", null)),
                "물병자리"
        );
    }

    @Test
    void interpretReturnsEmptyWithoutCallingClaudeWhenQuotaIsExhausted() {
        when(usageService.consume(1L, Feature.TAROT)).thenReturn(false);

        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);
        Optional<TarotInterpretationResponse> result = service.interpret(1L, sampleRequest());

        assertThat(result).isEmpty();
        verifyNoInteractions(interpreter);
        verifyNoInteractions(repository);
    }

    @Test
    void interpretSavesAndReturnsTheGeneratedTextWhenQuotaAllows() {
        when(usageService.consume(1L, Feature.TAROT)).thenReturn(true);
        when(interpreter.interpret(anyString())).thenReturn("따뜻한 해석 텍스트");
        when(repository.save(any(TarotInterpretation.class))).thenAnswer(inv -> inv.getArgument(0));

        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);
        Optional<TarotInterpretationResponse> result = service.interpret(1L, sampleRequest());

        assertThat(result).isPresent();
        assertThat(result.get().interpretationText()).isEqualTo("따뜻한 해석 텍스트");
        assertThat(result.get().mode()).isEqualTo("WITH_ZODIAC");
        assertThat(result.get().zodiacName()).isEqualTo("물병자리");
        assertThat(result.get().cards()).hasSize(1);
        assertThat(result.get().cards().get(0).nameKo()).isEqualTo("바보");
    }

    @Test
    void interpretPropagatesTheFailureWithoutSavingWhenClaudeCallFails() {
        when(usageService.consume(1L, Feature.TAROT)).thenReturn(true);
        when(interpreter.interpret(anyString())).thenThrow(new TarotInterpretationFailedException("boom", null));

        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);

        assertThatThrownBy(() -> service.interpret(1L, sampleRequest()))
                .isInstanceOf(TarotInterpretationFailedException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void getHistoryReturnsPastInterpretationsMostRecentFirst() {
        String cardsJson =
                "[{\"cardNumber\":0,\"nameKo\":\"바보\",\"keyword\":\"새로운 시작\",\"direction\":\"up\",\"positionLabel\":null}]";
        TarotInterpretation entity =
                new TarotInterpretation(1L, "WITH_ZODIAC", cardsJson, "물병자리", "해석문", Instant.now());
        when(repository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(entity));

        TarotInterpretationService service =
                new TarotInterpretationService(repository, usageService, interpreter, objectMapper);
        List<TarotInterpretationResponse> history = service.getHistory(1L);

        assertThat(history).hasSize(1);
        assertThat(history.get(0).interpretationText()).isEqualTo("해석문");
        assertThat(history.get(0).cards().get(0).nameKo()).isEqualTo("바보");
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests TarotInterpretationServiceTest`
Expected: FAIL (컴파일 에러 — `TarotInterpretationService`가 아직 없음)

- [ ] **Step 3: 서비스 구현**

`backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationService.java`:

```java
package com.lottopredictor.backend.tarotinterpretation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class TarotInterpretationService {

    private final TarotInterpretationRepository repository;
    private final UsageService usageService;
    private final ClaudeTarotInterpreter interpreter;
    private final ObjectMapper objectMapper;

    public TarotInterpretationService(
            TarotInterpretationRepository repository,
            UsageService usageService,
            ClaudeTarotInterpreter interpreter,
            ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.usageService = usageService;
        this.interpreter = interpreter;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Optional<TarotInterpretationResponse> interpret(Long userId, TarotInterpretationRequest request) {
        if (!usageService.consume(userId, Feature.TAROT)) {
            return Optional.empty();
        }

        String text = interpreter.interpret(buildPrompt(request));
        String cardsJson = writeCardsJson(request.cards());

        TarotInterpretation saved = repository.save(new TarotInterpretation(
                userId, request.mode(), cardsJson, request.zodiacName(), text, Instant.now()
        ));
        return Optional.of(toResponse(saved));
    }

    public List<TarotInterpretationResponse> getHistory(Long userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toResponse).toList();
    }

    private String buildPrompt(TarotInterpretationRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("TAROT_ONLY".equals(request.mode())
                ? "아래는 사용자가 뽑은 타로 3장(과거/현재/미래)입니다.\n"
                : "아래는 사용자가 뽑은 타로 1장입니다.\n");
        for (TarotInterpretationRequest.CardInput card : request.cards()) {
            sb.append("- ");
            if (card.positionLabel() != null) {
                sb.append("[").append(card.positionLabel()).append("] ");
            }
            sb.append(card.nameKo())
                    .append(" (키워드: ").append(card.keyword())
                    .append(", 방향: ").append(directionLabel(card.direction()))
                    .append(")\n");
        }
        if (request.zodiacName() != null) {
            sb.append("사용자의 별자리는 ").append(request.zodiacName()).append("입니다.\n");
        }
        sb.append("이 카드들을 하나의 이야기로 엮어서 종합 해석을 3~5문장으로 작성해줘.");
        return sb.toString();
    }

    private String directionLabel(String direction) {
        return switch (direction) {
            case "up" -> "위";
            case "down" -> "아래";
            case "left" -> "왼쪽";
            case "right" -> "오른쪽";
            default -> direction;
        };
    }

    private String writeCardsJson(List<TarotInterpretationRequest.CardInput> cards) {
        try {
            return objectMapper.writeValueAsString(cards);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("failed to serialize tarot cards", e);
        }
    }

    private List<TarotInterpretationRequest.CardInput> readCardsJson(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<List<TarotInterpretationRequest.CardInput>>() {
            });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("failed to deserialize tarot cards", e);
        }
    }

    private TarotInterpretationResponse toResponse(TarotInterpretation entity) {
        return new TarotInterpretationResponse(
                entity.getId(),
                entity.getMode(),
                readCardsJson(entity.getCardsJson()),
                entity.getZodiac(),
                entity.getInterpretationText(),
                entity.getCreatedAt()
        );
    }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests TarotInterpretationServiceTest`
Expected: BUILD SUCCESSFUL, 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationService.java backend/src/test/java/com/lottopredictor/backend/tarotinterpretation/TarotInterpretationServiceTest.java
git commit -m "Add TarotInterpretationService with quota-gated Claude calls"
```

---

### Task 5: `TarotInterpretationController` + `ProgressController` 정리

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/api/TarotInterpretationController.java`
- Modify: `backend/src/main/java/com/lottopredictor/backend/api/ProgressController.java`

**Interfaces:**
- Consumes: `TarotInterpretationService.interpret/getHistory`(Task 4), `TarotInterpretationRequest/Response`(Task 2), 기존 `AuthPrincipal`/`AuthenticatedUser`, 기존 `UsageService`/`Feature`
- Produces: `POST /api/tarot/interpretation` (200/429/502), `GET /api/tarot/interpretations` (200), `POST /api/progress/generate-usage` (200/429) — Task 6/7의 프론트 `lib` 함수가 이 엔드포인트들을 호출한다.

기존 `POST /api/progress/tarot-usage`는 이제 아무 프론트 코드도 호출하지 않게 된다(AI 해석 요청 시 횟수 소모가 `TarotInterpretationService` 내부에서 직접 처리되므로). 이 태스크에서 죽은 엔드포인트를 제거한다.

- [ ] **Step 1: TarotInterpretationController 작성**

`backend/src/main/java/com/lottopredictor/backend/api/TarotInterpretationController.java`:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.tarotinterpretation.TarotInterpretationFailedException;
import com.lottopredictor.backend.tarotinterpretation.TarotInterpretationRequest;
import com.lottopredictor.backend.tarotinterpretation.TarotInterpretationResponse;
import com.lottopredictor.backend.tarotinterpretation.TarotInterpretationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class TarotInterpretationController {

    private final TarotInterpretationService service;

    public TarotInterpretationController(TarotInterpretationService service) {
        this.service = service;
    }

    @PostMapping("/api/tarot/interpretation")
    public ResponseEntity<TarotInterpretationResponse> interpret(
            @RequestBody TarotInterpretationRequest request,
            @AuthPrincipal AuthenticatedUser principal
    ) {
        try {
            return service.interpret(principal.userId(), request)
                    .map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build());
        } catch (TarotInterpretationFailedException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }

    @GetMapping("/api/tarot/interpretations")
    public List<TarotInterpretationResponse> history(@AuthPrincipal AuthenticatedUser principal) {
        return service.getHistory(principal.userId());
    }
}
```

- [ ] **Step 2: ProgressController 수정 — `tarot-usage` 제거, `generate-usage` 추가**

`backend/src/main/java/com/lottopredictor/backend/api/ProgressController.java` 전체를 다음으로 교체:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.progress.Feature;
import com.lottopredictor.backend.progress.ProgressResponse;
import com.lottopredictor.backend.progress.UsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProgressController {

    private final UsageService usageService;

    public ProgressController(UsageService usageService) {
        this.usageService = usageService;
    }

    @GetMapping("/api/progress/me")
    public ProgressResponse me(@AuthPrincipal AuthenticatedUser principal) {
        usageService.recordVisit(principal.userId());
        return usageService.getProgress(principal.userId());
    }

    @PostMapping("/api/progress/generate-usage")
    public ResponseEntity<ProgressResponse> generateUsage(@AuthPrincipal AuthenticatedUser principal) {
        if (!usageService.consume(principal.userId(), Feature.GENERATE)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        return ResponseEntity.ok(usageService.getProgress(principal.userId()));
    }
}
```

- [ ] **Step 3: 전체 백엔드 테스트 실행**

Run: `cd backend && ./gradlew test`
Expected: BUILD SUCCESSFUL (기존 테스트 전부 통과 — `tarot-usage` 엔드포인트에 대한 전용 컨트롤러 테스트는 애초에 없었으므로 깨질 테스트가 없다)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/api/TarotInterpretationController.java backend/src/main/java/com/lottopredictor/backend/api/ProgressController.java
git commit -m "Add tarot interpretation endpoints; replace tarot-usage with generate-usage"
```

---

### Task 6: 프론트 `lib/tarotInterpretation.ts` (+ 테스트)

**Files:**
- Create: `frontend/lib/tarotInterpretation.ts`
- Test: `frontend/lib/tarotInterpretation.test.ts`

**Interfaces:**
- Produces: `type TarotInterpretationMode = "TAROT_ONLY" | "WITH_ZODIAC"`, `interface TarotCardInput { cardNumber: number; nameKo: string; keyword: string; direction: "up"|"down"|"left"|"right"; positionLabel: string | null }`, `interface TarotInterpretationResult { id: number; mode: TarotInterpretationMode; cards: TarotCardInput[]; zodiacName: string | null; interpretationText: string; createdAt: string }`, `requestTarotInterpretation(mode, cards, zodiacName, token): Promise<TarotInterpretationResult>`, `getTarotInterpretationHistory(token): Promise<TarotInterpretationResult[]>` — Task 8/9가 이 타입/함수들을 그대로 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/tarotInterpretation.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestTarotInterpretation, getTarotInterpretationHistory } from "./tarotInterpretation";

describe("requestTarotInterpretation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the interpretation on success", async () => {
    const payload = {
      id: 1,
      mode: "WITH_ZODIAC",
      cards: [{ cardNumber: 0, nameKo: "바보", keyword: "새로운 시작", direction: "up", positionLabel: null }],
      zodiacName: "물병자리",
      interpretationText: "따뜻한 해석 텍스트",
      createdAt: "2026-07-26T10:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await requestTarotInterpretation(
      "WITH_ZODIAC",
      [{ cardNumber: 0, nameKo: "바보", keyword: "새로운 시작", direction: "up", positionLabel: null }],
      "물병자리",
      "jwt-abc"
    );

    expect(result).toEqual(payload);
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(
      requestTarotInterpretation("TAROT_ONLY", [], null, "jwt-abc")
    ).rejects.toThrow("오늘 AI 해석 횟수를 다 쓰셨어요. 내일 다시 찾아와 주세요.");
  });

  it("throws a generic message on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));

    await expect(
      requestTarotInterpretation("TAROT_ONLY", [], null, "jwt-abc")
    ).rejects.toThrow("해석을 가져오지 못했어요. 다시 시도해주세요.");
  });
});

describe("getTarotInterpretationHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the history list on success", async () => {
    const payload = [
      {
        id: 1,
        mode: "TAROT_ONLY",
        cards: [{ cardNumber: 0, nameKo: "바보", keyword: "새로운 시작", direction: "up", positionLabel: "과거" }],
        zodiacName: null,
        interpretationText: "해석문",
        createdAt: "2026-07-26T10:00:00Z",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getTarotInterpretationHistory("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getTarotInterpretationHistory("jwt-abc")).rejects.toThrow(
      "타로 해석 기록을 불러오지 못했습니다."
    );
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/tarotInterpretation.test.ts`
Expected: FAIL (모듈이 아직 없음)

- [ ] **Step 3: 구현**

`frontend/lib/tarotInterpretation.ts`:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type TarotInterpretationMode = "TAROT_ONLY" | "WITH_ZODIAC";

export interface TarotCardInput {
  cardNumber: number;
  nameKo: string;
  keyword: string;
  direction: "up" | "down" | "left" | "right";
  positionLabel: string | null;
}

export interface TarotInterpretationResult {
  id: number;
  mode: TarotInterpretationMode;
  cards: TarotCardInput[];
  zodiacName: string | null;
  interpretationText: string;
  createdAt: string;
}

export async function requestTarotInterpretation(
  mode: TarotInterpretationMode,
  cards: TarotCardInput[],
  zodiacName: string | null,
  token: string
): Promise<TarotInterpretationResult> {
  const res = await fetch(`${API_BASE_URL}/api/tarot/interpretation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode, cards, zodiacName }),
  });
  if (res.status === 429) {
    throw new Error("오늘 AI 해석 횟수를 다 쓰셨어요. 내일 다시 찾아와 주세요.");
  }
  if (!res.ok) {
    throw new Error("해석을 가져오지 못했어요. 다시 시도해주세요.");
  }
  return res.json();
}

export async function getTarotInterpretationHistory(token: string): Promise<TarotInterpretationResult[]> {
  const res = await fetch(`${API_BASE_URL}/api/tarot/interpretations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("타로 해석 기록을 불러오지 못했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run lib/tarotInterpretation.test.ts`
Expected: 6 tests passed

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/tarotInterpretation.ts frontend/lib/tarotInterpretation.test.ts
git commit -m "Add frontend client for tarot AI interpretation endpoints"
```

---

### Task 7: `generateTarotNumberSets` 추가 + `consumeGenerateUsage` 추가 (기존 함수는 그대로 유지)

**Files:**
- Modify: `frontend/lib/tarotNumberGenerator.ts`
- Modify: `frontend/lib/tarotNumberGenerator.test.ts`
- Modify: `frontend/lib/progress.ts`
- Modify: `frontend/lib/progress.test.ts`

**Interfaces:**
- Consumes: 기존 `buildWeights`, `weightedSampleWithoutReplacement` (같은 파일 내부 함수, 수정 없음)
- Produces: `generateTarotNumberSets(card: TarotCard, zodiac: ZodiacSign | null, direction: CardDirection, count: number): number[][]`, `consumeGenerateUsage(token: string): Promise<ProgressResult>` — Task 8이 이 두 함수를 사용한다.

**주의:** 이 태스크는 기존 `generateTarotNumbers`/`generateTarotNumbersForPicks`/`buildWeightsForPicks`/`CardPick`(tarotNumberGenerator.ts)와 `consumeTarotUsage`(progress.ts)를 **아직 지우지 않는다** — 현재 `/tarot` 페이지가 여전히 이 함수들을 쓰고 있어서 지금 지우면 타입체크가 깨진다. 이 함수들의 제거는 페이지를 재작성하는 Task 8에서 함께 처리한다 (그 태스크가 실제로 이 함수들을 안 쓰게 만드는 지점이라 죽은 코드가 생기는 시점과 지우는 시점이 정확히 일치한다).

- [ ] **Step 1: tarotNumberGenerator 테스트에 실패하는 케이스 추가**

`frontend/lib/tarotNumberGenerator.test.ts` 끝에 추가:

```ts
describe("generateTarotNumberSets", () => {
  it("produces the requested number of independent 6-number sets", () => {
    const sets = generateTarotNumberSets(star, aries, "up", 3);
    expect(sets).toHaveLength(3);
    for (const numbers of sets) {
      expect(numbers).toHaveLength(6);
      expect(new Set(numbers).size).toBe(6);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
    }
  });

  it("returns exactly one set when count is 1", () => {
    const sets = generateTarotNumberSets(star, null, "down", 1);
    expect(sets).toHaveLength(1);
  });
});
```

그리고 파일 상단 import 줄에 `generateTarotNumberSets`를 추가:

```ts
import {
  buildWeights,
  buildWeightsForPicks,
  cardSeedNumber,
  generateTarotNumberSets,
  generateTarotNumbers,
  generateTarotNumbersForPicks,
  weightedSampleWithoutReplacement,
} from "./tarotNumberGenerator";
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/tarotNumberGenerator.test.ts`
Expected: FAIL (`generateTarotNumberSets`가 아직 없음)

- [ ] **Step 3: `generateTarotNumberSets` 구현**

`frontend/lib/tarotNumberGenerator.ts` 끝(`generateTarotNumbersForPicks` 함수 뒤)에 추가:

```ts
export function generateTarotNumberSets(
  card: TarotCard,
  zodiac: ZodiacSign | null,
  direction: CardDirection,
  count: number
): number[][] {
  const weights = buildWeights(card, zodiac, direction);
  const sets: number[][] = [];
  for (let i = 0; i < count; i++) {
    sets.push(weightedSampleWithoutReplacement(weights, 6).sort((a, b) => a - b));
  }
  return sets;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run lib/tarotNumberGenerator.test.ts`
Expected: 모든 테스트 통과 (기존 테스트 + 신규 2개)

- [ ] **Step 5: progress.test.ts에 실패하는 케이스 추가**

`frontend/lib/progress.test.ts` 끝에 추가 (기존 `consumeTarotUsage` describe 블록은 그대로 둔다):

```ts
describe("consumeGenerateUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the updated progress on success", async () => {
    const payload = {
      tier: "초심자",
      totalPoints: 4,
      pointsToNextTier: 46,
      tarotUsage: { used: 0, limit: 1 },
      generateUsage: { used: 1, limit: 3 },
      maxSets: 3,
      adjustableSets: false,
      tierFloor: 0,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await consumeGenerateUsage("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(consumeGenerateUsage("jwt-abc")).rejects.toThrow(
      "오늘 번호생성 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요."
    );
  });

  it("throws a generic message on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(consumeGenerateUsage("jwt-abc")).rejects.toThrow("번호생성 처리에 실패했습니다.");
  });
});
```

그리고 파일 상단 import 줄을 다음으로 교체:

```ts
import { getProgress, consumeTarotUsage, consumeGenerateUsage, formatRemainingUsage } from "./progress";
```

- [ ] **Step 6: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/progress.test.ts`
Expected: FAIL (`consumeGenerateUsage`가 아직 없음)

- [ ] **Step 7: `consumeGenerateUsage` 구현**

`frontend/lib/progress.ts` 끝(`consumeTarotUsage` 함수 뒤)에 추가:

```ts
export async function consumeGenerateUsage(token: string): Promise<ProgressResult> {
  const res = await fetch(`${API_BASE_URL}/api/progress/generate-usage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    throw new Error("오늘 번호생성 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("번호생성 처리에 실패했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 8: 테스트 통과 확인 + 타입체크**

Run: `cd frontend && npx vitest run lib/progress.test.ts && npx tsc --noEmit`
Expected: 모든 테스트 통과, 타입 에러 없음

- [ ] **Step 9: Commit**

```bash
git add frontend/lib/tarotNumberGenerator.ts frontend/lib/tarotNumberGenerator.test.ts frontend/lib/progress.ts frontend/lib/progress.test.ts
git commit -m "Add generateTarotNumberSets and consumeGenerateUsage"
```

---

### Task 8: `/tarot` 페이지 3모드 재구성 + 죽은 코드 정리 + CSS

**Files:**
- Modify: `frontend/lib/tarotNumberGenerator.ts` (죽은 함수 제거)
- Modify: `frontend/lib/tarotNumberGenerator.test.ts` (죽은 함수 테스트 제거)
- Modify: `frontend/lib/progress.ts` (죽은 함수 제거)
- Modify: `frontend/lib/progress.test.ts` (죽은 함수 테스트 제거)
- Modify: `frontend/app/tarot/page.tsx` (전체 재작성)
- Modify: `frontend/app/tarot/page.module.css` (전체 재작성)

**Interfaces:**
- Consumes: `generateTarotNumberSets`, `consumeGenerateUsage`(Task 7), `requestTarotInterpretation`, `getTarotInterpretationHistory`, `type TarotCardInput`, `type TarotInterpretationMode`(Task 6), 기존 `formatRemainingUsage`, `useAuth`, `useProgress`, `saveNumbers`, `LottoDrawAnimation`, `getKakaoAuthorizeUrl`, `TAROT_CARDS`, `DIRECTION_LABELS`, `shuffleCards`, `detectDragDirection`, `getZodiacSign`, `getBallColor`
- Produces: 없음 (이 태스크가 이 브랜치의 마지막 사용자 대면 변경 — 이후 Task 9는 마이페이지만 건드린다)

이 태스크는 자동 테스트가 없다 (페이지 컴포넌트 자체 테스트는 이 프로젝트 컨벤션에 없음 — `/generate`, `/mypage`도 타입체크 + 브라우저 수동 확인만 한다). 타입체크와 브라우저 수동 검증으로 마무리한다.

- [ ] **Step 1: `tarotNumberGenerator.ts`에서 죽은 함수 제거**

`frontend/lib/tarotNumberGenerator.ts`에서 `CardPick` 인터페이스, `buildWeightsForPicks`, `generateTarotNumbers`(구버전 단일 세트), `generateTarotNumbersForPicks`를 삭제한다. 파일 전체를 다음으로 교체:

```ts
import type { CardDirection, TarotCard } from "./tarotCards";
import type { ZodiacSign } from "./zodiac";

const CARD_SEED_WEIGHT = 8;
const ZODIAC_WEIGHT = 5;
const DIRECTION_BOOST = 2;
const MIN_NUMBER = 1;
const MAX_NUMBER = 45;

export function cardSeedNumber(card: TarotCard): number {
  return card.number === 0 ? 22 : card.number;
}

function isInDirectionRange(n: number, direction: CardDirection, seed: number): boolean {
  switch (direction) {
    case "up":
      return n >= 24 && n <= MAX_NUMBER;
    case "down":
      return n >= MIN_NUMBER && n <= 23;
    case "left":
      return Math.abs(n - seed) <= 5;
    case "right":
      return Math.abs(n - seed) > 5;
  }
}

function baseWeights(): number[] {
  const weights = new Array(MAX_NUMBER + 1).fill(0);
  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
    weights[n] = 1;
  }
  return weights;
}

function addCardWeight(weights: number[], card: TarotCard, direction: CardDirection): void {
  const seed = cardSeedNumber(card);
  for (const n of [seed, seed + 22]) {
    if (n >= MIN_NUMBER && n <= MAX_NUMBER) weights[n] += CARD_SEED_WEIGHT;
  }
  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
    if (isInDirectionRange(n, direction, seed)) weights[n] += DIRECTION_BOOST;
  }
}

function addZodiacWeight(weights: number[], zodiac: ZodiacSign | null): void {
  if (!zodiac) return;
  for (const n of zodiac.luckyNumbers) {
    if (n >= MIN_NUMBER && n <= MAX_NUMBER) weights[n] += ZODIAC_WEIGHT;
  }
}

/** Index 0 is unused; weights live at indexes 1..45 to match lotto numbers directly. */
export function buildWeights(card: TarotCard, zodiac: ZodiacSign | null, direction: CardDirection): number[] {
  const weights = baseWeights();
  addCardWeight(weights, card, direction);
  addZodiacWeight(weights, zodiac);
  return weights;
}

export function weightedSampleWithoutReplacement(weights: number[], count: number): number[] {
  const pool: { n: number; w: number }[] = [];
  for (let n = 1; n < weights.length; n++) {
    if (weights[n] > 0) pool.push({ n, w: weights[n] });
  }

  const picked: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((sum, p) => sum + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    picked.push(pool[idx].n);
    pool.splice(idx, 1);
  }

  return picked;
}

export function generateTarotNumberSets(
  card: TarotCard,
  zodiac: ZodiacSign | null,
  direction: CardDirection,
  count: number
): number[][] {
  const weights = buildWeights(card, zodiac, direction);
  const sets: number[][] = [];
  for (let i = 0; i < count; i++) {
    sets.push(weightedSampleWithoutReplacement(weights, 6).sort((a, b) => a - b));
  }
  return sets;
}
```

- [ ] **Step 2: `tarotNumberGenerator.test.ts`에서 죽은 함수의 테스트 제거**

`frontend/lib/tarotNumberGenerator.test.ts` 전체를 다음으로 교체 (`buildWeightsForPicks`/`generateTarotNumbers`(구버전)/`generateTarotNumbersForPicks` 관련 describe 블록 제거, `generateTarotNumberSets` 블록은 유지):

```ts
import { describe, expect, it } from "vitest";
import {
  buildWeights,
  cardSeedNumber,
  generateTarotNumberSets,
  weightedSampleWithoutReplacement,
} from "./tarotNumberGenerator";
import { TAROT_CARDS } from "./tarotCards";
import { ZODIAC_SIGNS } from "./zodiac";

const star = TAROT_CARDS.find((c) => c.nameEn === "The Star")!; // number 17
const fool = TAROT_CARDS.find((c) => c.nameEn === "The Fool")!; // number 0
const aries = ZODIAC_SIGNS.find((z) => z.id === "aries")!; // luckyNumbers [9, 18, 27]

describe("cardSeedNumber", () => {
  it("substitutes 22 for The Fool's card number 0", () => {
    expect(cardSeedNumber(fool)).toBe(22);
  });

  it("uses the card's own tarot number otherwise", () => {
    expect(cardSeedNumber(star)).toBe(17);
  });
});

describe("buildWeights", () => {
  it("boosts the card's seed number and its +22 pair", () => {
    const weights = buildWeights(star, aries, "down");
    expect(weights[17]).toBeGreaterThanOrEqual(1 + 8);
    expect(weights[39]).toBeGreaterThanOrEqual(1 + 8);
  });

  it("boosts the zodiac's lucky numbers", () => {
    const weights = buildWeights(star, aries, "down");
    expect(weights[9]).toBeGreaterThanOrEqual(1 + 5);
    expect(weights[18]).toBeGreaterThanOrEqual(1 + 5);
    expect(weights[27]).toBeGreaterThanOrEqual(1 + 5);
  });

  it("boosts the upper half of the range for the 'up' direction", () => {
    const weights = buildWeights(star, aries, "up");
    expect(weights[45]).toBeGreaterThan(weights[1]);
  });

  it("boosts the lower half of the range for the 'down' direction", () => {
    const weights = buildWeights(star, aries, "down");
    expect(weights[1]).toBeGreaterThan(weights[45]);
  });

  it("boosts numbers near the card's seed for the 'left' direction", () => {
    const weights = buildWeights(star, aries, "left"); // seed = 17
    expect(weights[20]).toBeGreaterThan(weights[40]);
  });

  it("boosts numbers far from the card's seed for the 'right' direction", () => {
    const weights = buildWeights(star, aries, "right"); // seed = 17
    expect(weights[40]).toBeGreaterThan(weights[20]);
  });

  it("leaves every number in range at a positive weight", () => {
    const weights = buildWeights(star, aries, "down");
    for (let n = 1; n <= 45; n++) {
      expect(weights[n]).toBeGreaterThan(0);
    }
  });

  it("still boosts the card's seed number when no zodiac is given", () => {
    const weights = buildWeights(star, null, "down");
    expect(weights[17]).toBeGreaterThanOrEqual(1 + 8);
    expect(weights[39]).toBeGreaterThanOrEqual(1 + 8);
  });

  it("does not boost any number for the zodiac's lucky numbers when no zodiac is given", () => {
    const withZodiac = buildWeights(star, aries, "down");
    const withoutZodiac = buildWeights(star, null, "down");
    for (const n of aries.luckyNumbers) {
      expect(withoutZodiac[n]).toBeLessThan(withZodiac[n]);
    }
  });
});

describe("weightedSampleWithoutReplacement", () => {
  it("picks the requested count of unique numbers", () => {
    const weights = new Array(46).fill(0);
    for (let n = 1; n <= 45; n++) weights[n] = 1;

    const picked = weightedSampleWithoutReplacement(weights, 6);

    expect(picked).toHaveLength(6);
    expect(new Set(picked).size).toBe(6);
    for (const n of picked) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(45);
    }
  });

  it("never picks a number with zero weight", () => {
    const weights = new Array(46).fill(0);
    weights[1] = 1;
    weights[2] = 1;
    weights[3] = 1;

    const picked = weightedSampleWithoutReplacement(weights, 3);

    expect(new Set(picked)).toEqual(new Set([1, 2, 3]));
  });
});

describe("generateTarotNumberSets", () => {
  it("produces the requested number of independent 6-number sets", () => {
    const sets = generateTarotNumberSets(star, aries, "up", 3);
    expect(sets).toHaveLength(3);
    for (const numbers of sets) {
      expect(numbers).toHaveLength(6);
      expect(new Set(numbers).size).toBe(6);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
    }
  });

  it("returns exactly one set when count is 1", () => {
    const sets = generateTarotNumberSets(star, null, "down", 1);
    expect(sets).toHaveLength(1);
  });
});
```

- [ ] **Step 3: `progress.ts`에서 `consumeTarotUsage` 제거**

`frontend/lib/progress.ts`에서 `consumeTarotUsage` 함수를 삭제한다. 파일 전체를 다음으로 교체:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export interface ProgressResult {
  tier: string;
  totalPoints: number;
  pointsToNextTier: number | null;
  tarotUsage: { used: number; limit: number };
  generateUsage: { used: number; limit: number };
  maxSets: number;
  adjustableSets: boolean;
  tierFloor: number;
}

const UNLIMITED_THRESHOLD = 1_000_000;

export function formatRemainingUsage(usage: { used: number; limit: number }): string {
  if (usage.limit >= UNLIMITED_THRESHOLD) {
    return "무제한";
  }
  return `${usage.limit - usage.used}/${usage.limit}`;
}

export async function getProgress(token: string): Promise<ProgressResult> {
  const res = await fetch(`${API_BASE_URL}/api/progress/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("등급 정보를 불러오지 못했습니다.");
  }
  return res.json();
}

export async function consumeGenerateUsage(token: string): Promise<ProgressResult> {
  const res = await fetch(`${API_BASE_URL}/api/progress/generate-usage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    throw new Error("오늘 번호생성 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("번호생성 처리에 실패했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 4: `progress.test.ts`에서 `consumeTarotUsage` 테스트 제거**

`frontend/lib/progress.test.ts`에서 `consumeTarotUsage` describe 블록을 삭제하고, import 줄에서 `consumeTarotUsage`를 제거한다. 파일 전체를 다음으로 교체:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getProgress, consumeGenerateUsage, formatRemainingUsage } from "./progress";

describe("formatRemainingUsage", () => {
  it("shows a used/limit fraction for a normal limit", () => {
    expect(formatRemainingUsage({ used: 1, limit: 3 })).toBe("2/3");
  });

  it("shows 무제한 when the limit is the unlimited sentinel", () => {
    expect(formatRemainingUsage({ used: 1, limit: 2147483647 })).toBe("무제한");
  });
});

describe("getProgress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the progress payload on success", async () => {
    const payload = {
      tier: "초심자",
      totalPoints: 3,
      pointsToNextTier: 47,
      tarotUsage: { used: 0, limit: 1 },
      generateUsage: { used: 0, limit: 1 },
      maxSets: 2,
      adjustableSets: false,
      tierFloor: 0,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await getProgress("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws when the backend responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(getProgress("jwt-abc")).rejects.toThrow("등급 정보를 불러오지 못했습니다.");
  });
});

describe("consumeGenerateUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the updated progress on success", async () => {
    const payload = {
      tier: "초심자",
      totalPoints: 4,
      pointsToNextTier: 46,
      tarotUsage: { used: 0, limit: 1 },
      generateUsage: { used: 1, limit: 3 },
      maxSets: 3,
      adjustableSets: false,
      tierFloor: 0,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));

    const result = await consumeGenerateUsage("jwt-abc");

    expect(result).toEqual(payload);
  });

  it("throws a quota-exceeded message on 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(consumeGenerateUsage("jwt-abc")).rejects.toThrow(
      "오늘 번호생성 횟수를 다 쓰셨어요. 등급을 올리면 더 뽑을 수 있어요."
    );
  });

  it("throws a generic message on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(consumeGenerateUsage("jwt-abc")).rejects.toThrow("번호생성 처리에 실패했습니다.");
  });
});
```

- [ ] **Step 5: `/tarot` 페이지 전체 재작성**

`frontend/app/tarot/page.tsx` 전체를 다음으로 교체:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { getBallColor } from "../../lib/lottoBall";
import { DIRECTION_LABELS, TAROT_CARDS, shuffleCards, type CardDirection, type TarotCard } from "../../lib/tarotCards";
import { detectDragDirection } from "../../lib/dragDirection";
import { generateTarotNumberSets } from "../../lib/tarotNumberGenerator";
import { getZodiacSign, type ZodiacSign } from "../../lib/zodiac";
import LottoDrawAnimation from "../components/LottoDrawAnimation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { consumeGenerateUsage, formatRemainingUsage } from "../../lib/progress";
import {
  requestTarotInterpretation,
  type TarotCardInput,
  type TarotInterpretationMode,
} from "../../lib/tarotInterpretation";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
import { saveNumbers } from "../../lib/savedNumbers";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i);
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type ViewMode = "unset" | "tarot-only" | "with-zodiac" | "number-draw";

interface SpreadSlot {
  card: TarotCard;
  direction: CardDirection | null;
}

const SPREAD_POSITIONS = ["과거", "현재", "미래"];
const SPREAD_SIZE = SPREAD_POSITIONS.length;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function Home() {
  const { auth } = useAuth();
  const { progress, refreshProgress } = useProgress();
  const [viewMode, setViewMode] = useState<ViewMode>("unset");
  const [year, setYear] = useState<number | "">("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState<number | null>(null);
  const [deck, setDeck] = useState<TarotCard[]>(() => shuffleCards(TAROT_CARDS));

  // single-card modes ("with-zodiac", "number-draw")
  const [selected, setSelected] = useState<TarotCard | null>(null);
  const [direction, setDirection] = useState<CardDirection | null>(null);

  // "tarot-only" mode: 3-card spread (과거/현재/미래)
  const [spreadSlots, setSpreadSlots] = useState<SpreadSlot[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // AI interpretation ("tarot-only", "with-zodiac")
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [interpretationError, setInterpretationError] = useState<string | null>(null);

  // number draw ("number-draw")
  const [drawSets, setDrawSets] = useState(1);
  const setsInitialized = useRef(false);
  const [drawResult, setDrawResult] = useState<number[][] | null>(null);
  const [pendingDrawResult, setPendingDrawResult] = useState<number[][] | null>(null);
  const [drawAnimating, setDrawAnimating] = useState(false);
  const [drawLoading, setDrawLoading] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (progress && !setsInitialized.current) {
      setDrawSets(progress.maxSets);
      setsInitialized.current = true;
    }
  }, [progress]);

  const calendarCells = useMemo(() => {
    if (!year) return [];
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const total = daysInMonth(year, month);
    const blanks: null[] = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from({ length: total }, (_, i) => i + 1);
    return [...blanks, ...days];
  }, [year, month]);

  const zodiac: ZodiacSign | null = useMemo(() => {
    if (!year || !day) return null;
    return getZodiacSign(new Date(year, month - 1, day));
  }, [year, month, day]);

  function handleYearChange(value: string) {
    setYear(value ? Number(value) : "");
    setDay(null);
  }

  function handlePrevMonth() {
    setMonth((m) => Math.max(1, m - 1));
    setDay(null);
  }

  function handleNextMonth() {
    setMonth((m) => Math.min(12, m + 1));
    setDay(null);
  }

  const isSingleCardMode = viewMode === "with-zodiac" || viewMode === "number-draw";
  const zodiacRequired = viewMode === "with-zodiac";
  const canPickCard = isSingleCardMode && (!zodiacRequired || zodiac !== null);

  // the card currently in the "drag to reveal" step, regardless of mode
  const revealingCard = isSingleCardMode
    ? selected && !direction
      ? selected
      : null
    : spreadSlots.length > 0 && spreadSlots[spreadSlots.length - 1].direction === null
      ? spreadSlots[spreadSlots.length - 1].card
      : null;

  function handleCardClick(card: TarotCard) {
    if (isSingleCardMode) {
      if (selected) return;
      setSelected(card);
    } else if (viewMode === "tarot-only") {
      if (spreadSlots.length >= SPREAD_SIZE || revealingCard) return;
      setSpreadSlots((prev) => [...prev, { card, direction: null }]);
      setDeck((prev) => prev.filter((c) => c.number !== card.number));
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture is best-effort (keeps the drag working on touch devices
      // even if capture isn't available); the drag logic below doesn't depend on it.
    }
    dragStart.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    setDragOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!dragStart.current || !revealingCard) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const detected = detectDragDirection(dx, dy);
    dragStart.current = null;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    if (!detected) {
      return;
    }
    if (isSingleCardMode) {
      setDirection(detected);
    } else {
      setSpreadSlots((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], direction: detected };
        return updated;
      });
    }
  }

  const previewDirection = isDragging ? detectDragDirection(dragOffset.x, dragOffset.y, 15) : null;

  const spreadReady = spreadSlots.length === SPREAD_SIZE && spreadSlots.every((s) => s.direction !== null);

  function buildCardInputs(): TarotCardInput[] {
    if (viewMode === "tarot-only") {
      return spreadSlots.map((slot, i) => ({
        cardNumber: slot.card.number,
        nameKo: slot.card.nameKo,
        keyword: slot.card.keyword,
        direction: slot.direction as CardDirection,
        positionLabel: SPREAD_POSITIONS[i],
      }));
    }
    if (selected && direction) {
      return [
        {
          cardNumber: selected.number,
          nameKo: selected.nameKo,
          keyword: selected.keyword,
          direction,
          positionLabel: null,
        },
      ];
    }
    return [];
  }

  async function handleRequestInterpretation() {
    if (!auth) return;
    setInterpreting(true);
    setInterpretationError(null);
    try {
      const mode: TarotInterpretationMode = viewMode === "tarot-only" ? "TAROT_ONLY" : "WITH_ZODIAC";
      const result = await requestTarotInterpretation(mode, buildCardInputs(), zodiac?.name ?? null, auth.token);
      setInterpretation(result.interpretationText);
      refreshProgress();
    } catch (err) {
      setInterpretationError(err instanceof Error ? err.message : "해석을 가져오지 못했어요. 다시 시도해주세요.");
    } finally {
      setInterpreting(false);
    }
  }

  async function handleDrawNumbers() {
    if (!auth || !selected || !direction) return;
    setDrawError(null);
    setDrawLoading(true);
    try {
      await consumeGenerateUsage(auth.token);
    } catch (err) {
      setDrawError(err instanceof Error ? err.message : "오늘 번호생성 횟수를 다 쓰셨어요.");
      setDrawLoading(false);
      return;
    }
    refreshProgress();
    setDrawLoading(false);
    const sets = generateTarotNumberSets(selected, zodiac, direction, drawSets);
    setSavedIndices(new Set());
    setSaveErrors({});
    if (drawSets === 1) {
      setDrawResult(null);
      setPendingDrawResult(sets);
      setDrawAnimating(true);
    } else {
      setPendingDrawResult(null);
      setDrawAnimating(false);
      setDrawResult(sets);
    }
  }

  function handleDrawComplete() {
    setDrawResult(pendingDrawResult);
    setPendingDrawResult(null);
    setDrawAnimating(false);
  }

  async function handleSaveSet(index: number, set: number[]) {
    if (!auth) return;
    setSavingIndex(index);
    setSaveErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    try {
      await saveNumbers("TAROT", set, auth.token);
      setSavedIndices((prev) => new Set(prev).add(index));
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [index]: err instanceof Error ? err.message : "저장에 실패했습니다.",
      }));
    } finally {
      setSavingIndex(null);
    }
  }

  function handleReset() {
    setDeck(shuffleCards(TAROT_CARDS));
    setSelected(null);
    setDirection(null);
    setSpreadSlots([]);
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setInterpreting(false);
    setInterpretation(null);
    setInterpretationError(null);
    setDrawResult(null);
    setPendingDrawResult(null);
    setDrawAnimating(false);
    setDrawLoading(false);
    setDrawError(null);
    setSavedIndices(new Set());
    setSavingIndex(null);
    setSaveErrors({});
  }

  function handleChangeMode() {
    setViewMode("unset");
    setYear("");
    setMonth(1);
    setDay(null);
    handleReset();
  }

  const fortuneText = useMemo(() => {
    if (!selected || !direction) return null;
    return selected.fortunes[direction];
  }, [selected, direction]);

  const nextPositionLabel =
    viewMode === "tarot-only" && !revealingCard && spreadSlots.length < SPREAD_SIZE
      ? SPREAD_POSITIONS[spreadSlots.length]
      : null;
  const revealingPositionLabel =
    viewMode === "tarot-only" && revealingCard ? SPREAD_POSITIONS[spreadSlots.length - 1] : null;

  if (!auth) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>타로 운세 번호</h1>
          <p className={styles.subtitle}>
            카드로 오늘의 이야기를 만들어 보세요.
            <br />
            실제 운세를 예측하는 것은 아니며, 재미로 참고해 주세요.
          </p>
        </section>
        <div className={styles.card}>
          <p className={styles.hint}>타로를 보려면 로그인이 필요해요.</p>
          <a href={getKakaoAuthorizeUrl()} className={styles.generateButton}>
            카카오로 로그인
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>타로 운세 번호</h1>
        <p className={styles.subtitle}>
          카드로 오늘의 이야기를 만들어 보세요.
          <br />
          실제 운세를 예측하는 것은 아니며, 재미로 참고해 주세요.
        </p>
      </section>

      {viewMode === "unset" && (
        <div className={styles.modeChoice}>
          <button type="button" className={styles.modeButton} onClick={() => setViewMode("tarot-only")}>
            <span>타로만 보기</span>
            {progress && (
              <span className={styles.modeButtonUsage}>AI 해석 {formatRemainingUsage(progress.tarotUsage)} 남음</span>
            )}
          </button>
          <button type="button" className={styles.modeButton} onClick={() => setViewMode("with-zodiac")}>
            <span>생년월일로 별자리도 함께 보기</span>
            {progress && (
              <span className={styles.modeButtonUsage}>AI 해석 {formatRemainingUsage(progress.tarotUsage)} 남음</span>
            )}
          </button>
          <button type="button" className={styles.modeButton} onClick={() => setViewMode("number-draw")}>
            <span>번호 뽑기용 타로</span>
            {progress && (
              <span className={styles.modeButtonUsage}>
                번호생성 {formatRemainingUsage(progress.generateUsage)} 남음
              </span>
            )}
          </button>
        </div>
      )}

      {viewMode !== "unset" && (
        <button type="button" className={styles.changeModeLink} onClick={handleChangeMode}>
          ← 다른 방식으로 다시 시작하기
        </button>
      )}

      {isSingleCardMode && (
        <div className={styles.card}>
          <span className={styles.fieldLabel}>생년월일{viewMode === "number-draw" ? " (선택)" : ""}</span>
          <select
            aria-label="출생 연도"
            className={styles.yearSelect}
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            <option value="">년도 선택</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>

          {year && (
            <div className={styles.calendar}>
              <div className={styles.calendarHeader}>
                <button
                  type="button"
                  className={styles.calendarNav}
                  onClick={handlePrevMonth}
                  disabled={month === 1}
                  aria-label="이전 달"
                >
                  ‹
                </button>
                <span className={styles.calendarTitle}>
                  {year}년 {month}월
                </span>
                <button
                  type="button"
                  className={styles.calendarNav}
                  onClick={handleNextMonth}
                  disabled={month === 12}
                  aria-label="다음 달"
                >
                  ›
                </button>
              </div>
              <div className={styles.calendarGrid}>
                {WEEKDAY_LABELS.map((w) => (
                  <span key={w} className={styles.calendarWeekday}>
                    {w}
                  </span>
                ))}
                {calendarCells.map((d, i) =>
                  d === null ? (
                    <span key={`blank-${i}`} />
                  ) : (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.calendarDay} ${day === d ? styles.calendarDaySelected : ""}`}
                      onClick={() => setDay(d)}
                    >
                      {d}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {zodiac && <p className={styles.zodiacResult}>당신의 별자리는 {zodiac.name}입니다.</p>}
          {viewMode === "number-draw" && !zodiac && (
            <p className={styles.hint}>생년월일을 입력하지 않아도 카드만으로 번호를 뽑을 수 있어요.</p>
          )}
        </div>
      )}

      {isSingleCardMode && !selected && canPickCard && (
        <div className={styles.spreadWrapper}>
          <p className={styles.hint}>카드 한 장을 골라주세요.</p>
          <div className={styles.spread}>
            {deck.map((card, i) => (
              <button
                key={card.number}
                type="button"
                className={styles.cardBack}
                onClick={() => handleCardClick(card)}
                aria-label={`카드 ${i + 1}`}
              >
                <span className={styles.cardBackSymbol}>✦</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {viewMode === "tarot-only" && nextPositionLabel && (
        <div className={styles.spreadWrapper}>
          <p className={styles.hint}>
            "{nextPositionLabel}" 카드를 골라주세요. ({spreadSlots.length + 1}/{SPREAD_SIZE})
          </p>
          <div className={styles.spread}>
            {deck.map((card, i) => (
              <button
                key={card.number}
                type="button"
                className={styles.cardBack}
                onClick={() => handleCardClick(card)}
                aria-label={`카드 ${i + 1}`}
              >
                <span className={styles.cardBackSymbol}>✦</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {revealingCard && (
        <div className={styles.revealWrapper}>
          <p className={styles.hint}>
            {revealingPositionLabel && `"${revealingPositionLabel}" `}
            카드를 원하는 방향으로 드래그해서 뒤집어 보세요.
          </p>
          <div
            className={`${styles.dragCard} ${!isDragging ? styles.dragCardSnap : ""}`}
            style={{
              transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.05}deg)`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <span className={styles.cardBackSymbol}>✦</span>
          </div>
          <div className={styles.directionHints}>
            <span className={previewDirection === "up" ? styles.directionHintActive : ""}>↑ 위</span>
            <span className={previewDirection === "down" ? styles.directionHintActive : ""}>↓ 아래</span>
            <span className={previewDirection === "left" ? styles.directionHintActive : ""}>← 왼쪽</span>
            <span className={previewDirection === "right" ? styles.directionHintActive : ""}>→ 오른쪽</span>
          </div>
        </div>
      )}

      {viewMode === "with-zodiac" && selected && direction && (
        <div className={styles.resultCard}>
          <Image
            src={`/tarot/${selected.number}.jpg`}
            alt={`${selected.nameKo} (${selected.nameEn})`}
            width={200}
            height={335}
            className={styles.cardImage}
            priority
          />
          <div className={styles.resultHeader}>
            <span className={styles.cardName}>
              {selected.nameKo} <span className={styles.cardNameEn}>({selected.nameEn})</span>
            </span>
            <span className={styles.cardKeyword}>{selected.keyword}</span>
          </div>
          <p className={styles.directionLabel}>{DIRECTION_LABELS[direction]} 방향으로 뒤집혔습니다</p>
          <p className={styles.fortuneText}>{fortuneText}</p>
          {zodiac && (
            <p className={styles.zodiacBlurb}>
              {zodiac.name}인 당신에게는 {zodiac.luckyNumbers.join(", ")}번이 특별한 기운을 더합니다.
            </p>
          )}

          {!interpretation && !interpreting && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleRequestInterpretation}>
                종합 해석 보기
              </button>
              {interpretationError && <p className={styles.hint}>{interpretationError}</p>}
              {!zodiac && <p className={styles.hint}>생년월일을 입력하면 별자리 운도 함께 반영돼요.</p>}
            </>
          )}

          {interpreting && <p className={styles.hint}>카드를 읽는 중입니다...</p>}

          {interpretation && <p className={styles.interpretationText}>{interpretation}</p>}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
        </div>
      )}

      {viewMode === "tarot-only" && spreadReady && (
        <div className={styles.resultCard}>
          {spreadSlots.map((slot, i) => (
            <div key={slot.card.number} className={styles.spreadPickRow}>
              <Image
                src={`/tarot/${slot.card.number}.jpg`}
                alt={`${slot.card.nameKo} (${slot.card.nameEn})`}
                width={110}
                height={184}
                className={styles.cardImageSmall}
              />
              <div className={styles.spreadPickText}>
                <span className={styles.positionLabel}>{SPREAD_POSITIONS[i]}</span>
                <span className={styles.cardName}>
                  {slot.card.nameKo} <span className={styles.cardNameEn}>({slot.card.nameEn})</span>
                </span>
                <span className={styles.directionLabel}>{DIRECTION_LABELS[slot.direction!]} 방향</span>
                <p className={styles.fortuneTextSmall}>{slot.card.fortunes[slot.direction!]}</p>
              </div>
            </div>
          ))}

          {!interpretation && !interpreting && (
            <>
              <button type="button" className={styles.generateButton} onClick={handleRequestInterpretation}>
                종합 해석 보기
              </button>
              {interpretationError && <p className={styles.hint}>{interpretationError}</p>}
            </>
          )}

          {interpreting && <p className={styles.hint}>카드를 읽는 중입니다...</p>}

          {interpretation && <p className={styles.interpretationText}>{interpretation}</p>}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
        </div>
      )}

      {viewMode === "number-draw" && selected && direction && (
        <div className={styles.resultCard}>
          <Image
            src={`/tarot/${selected.number}.jpg`}
            alt={`${selected.nameKo} (${selected.nameEn})`}
            width={200}
            height={335}
            className={styles.cardImage}
            priority
          />
          <div className={styles.resultHeader}>
            <span className={styles.cardName}>
              {selected.nameKo} <span className={styles.cardNameEn}>({selected.nameEn})</span>
            </span>
            <span className={styles.cardKeyword}>{selected.keyword}</span>
          </div>
          <p className={styles.directionLabel}>{DIRECTION_LABELS[direction]} 방향으로 뒤집혔습니다</p>

          {!drawResult && !drawAnimating && (
            <>
              <div className={styles.setsField}>
                {progress?.adjustableSets ? (
                  <>
                    <span>세트 수 (최대 {progress.maxSets})</span>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.stepperButton}
                        onClick={() => setDrawSets((s) => Math.max(1, s - 1))}
                        disabled={drawSets <= 1}
                        aria-label="세트 수 감소"
                      >
                        −
                      </button>
                      <span className={styles.stepperValue}>{drawSets}</span>
                      <button
                        type="button"
                        className={styles.stepperButton}
                        onClick={() => setDrawSets((s) => Math.min(progress.maxSets, s + 1))}
                        disabled={drawSets >= progress.maxSets}
                        aria-label="세트 수 증가"
                      >
                        +
                      </button>
                    </div>
                  </>
                ) : (
                  <span>
                    세트 수: {progress?.maxSets ?? 1}세트 ({progress?.tier} 등급)
                  </span>
                )}
              </div>
              <button type="button" className={styles.generateButton} onClick={handleDrawNumbers} disabled={drawLoading}>
                {drawLoading ? "번호 뽑는 중..." : "번호 뽑기"}
              </button>
              {drawError && <p className={styles.hint}>{drawError}</p>}
            </>
          )}

          {drawAnimating && pendingDrawResult && (
            <div className={styles.animationWrapper}>
              <LottoDrawAnimation numbers={pendingDrawResult[0]} onComplete={handleDrawComplete} />
            </div>
          )}

          {drawResult && (
            <div className={styles.drawResultList}>
              {drawResult.map((set, i) => (
                <div key={i} className={styles.drawResultRow}>
                  <div className={styles.numbersRow}>
                    {set.map((n) => (
                      <span key={n} className={styles.ball} style={{ backgroundColor: getBallColor(n) }}>
                        {n}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => handleSaveSet(i, set)}
                    disabled={savedIndices.has(i) || savingIndex === i}
                  >
                    {savedIndices.has(i) ? "저장됨" : savingIndex === i ? "저장 중..." : "저장"}
                  </button>
                  {saveErrors[i] && <p className={styles.saveError}>{saveErrors[i]}</p>}
                </div>
              ))}
            </div>
          )}

          <button type="button" className={styles.resetButton} onClick={handleReset}>
            다시 뽑기
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `page.module.css` 전체 재작성**

`frontend/app/tarot/page.module.css` 전체를 다음으로 교체 (기존 규칙 대부분 유지, `.modeButton`을 두 줄짜리 레이아웃으로 변경하고 `.modeButtonUsage`/`.interpretationText`/`.drawResultList`/`.drawResultRow`/`.setsField`/`.stepper`/`.stepperButton`/`.stepperValue`를 추가, `.generateButton:disabled` 추가):

```css
.page {
  --cosmic-bg: #100a2e;
  --cosmic-surface: #1c1444;
  --cosmic-border: #3a2b6e;
  --cosmic-text: #ece7fb;
  --cosmic-text-secondary: #b3a6dd;
  --cosmic-gold: #e0b84f;
  --cosmic-gold-soft: #4a3a1f;

  max-width: 640px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  min-height: 100vh;
  background:
    radial-gradient(1px 1px at 10% 20%, #ffffff 100%, transparent),
    radial-gradient(1px 1px at 80% 10%, #ffffff 100%, transparent),
    radial-gradient(1px 1px at 60% 35%, #ffffff 100%, transparent),
    radial-gradient(1.5px 1.5px at 30% 60%, #ffffff 100%, transparent),
    radial-gradient(1px 1px at 90% 70%, #ffffff 100%, transparent),
    radial-gradient(1.5px 1.5px at 45% 85%, #ffffff 100%, transparent),
    radial-gradient(1px 1px at 15% 90%, #ffffff 100%, transparent),
    linear-gradient(160deg, #0b0730 0%, #1a103d 45%, #2a1454 100%);
  background-color: var(--cosmic-bg);
  color: var(--cosmic-text);
  color-scheme: dark;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-align: center;
}

.title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--cosmic-gold);
  text-shadow: 0 0 18px rgba(224, 184, 79, 0.35);
}

.subtitle {
  color: var(--cosmic-text-secondary);
  font-size: 0.95rem;
  line-height: 1.6;
}

.modeChoice {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modeButton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 1rem;
  border: 1px solid var(--cosmic-border);
  border-radius: 14px;
  background: var(--cosmic-surface);
  color: var(--cosmic-text);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.modeButton:hover {
  border-color: var(--cosmic-gold);
  background: var(--cosmic-gold-soft);
}

.modeButtonUsage {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--cosmic-text-secondary);
}

.changeModeLink {
  align-self: center;
  border: none;
  background: transparent;
  color: var(--cosmic-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: color 0.15s ease;
}

.changeModeLink:hover {
  color: var(--cosmic-gold);
}

.animationWrapper {
  --surface: var(--cosmic-surface);
  --surface-border: var(--cosmic-border);
  --surface-hover: var(--cosmic-gold-soft);
  --text-secondary: var(--cosmic-text-secondary);
  --accent: var(--cosmic-gold);
  width: 100%;
  display: flex;
  justify-content: center;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.5rem;
  background: var(--cosmic-surface);
  border: 1px solid var(--cosmic-border);
  border-radius: 18px;
}

.fieldLabel {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--cosmic-text-secondary);
}

.yearSelect {
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--cosmic-border);
  border-radius: 10px;
  background: var(--cosmic-bg);
  color: var(--cosmic-text);
  font-size: 0.9rem;
  color-scheme: dark;
  cursor: pointer;
}

.yearSelect:focus {
  outline: none;
  border-color: var(--cosmic-gold);
}

.calendar {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem;
  background: var(--cosmic-bg);
  border: 1px solid var(--cosmic-border);
  border-radius: 12px;
}

.calendarHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.calendarTitle {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--cosmic-gold);
}

.calendarNav {
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid var(--cosmic-border);
  border-radius: 50%;
  background: transparent;
  color: var(--cosmic-text);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.calendarNav:hover:not(:disabled) {
  border-color: var(--cosmic-gold);
  color: var(--cosmic-gold);
}

.calendarNav:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.calendarGrid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.3rem;
}

.calendarWeekday {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cosmic-text-secondary);
  padding-bottom: 0.2rem;
}

.calendarDay {
  aspect-ratio: 1;
  border: none;
  border-radius: 8px;
  background: var(--cosmic-surface);
  color: var(--cosmic-text);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.calendarDay:hover {
  background: var(--cosmic-gold-soft);
}

.calendarDaySelected {
  background: var(--cosmic-gold);
  color: #241a02;
  font-weight: 700;
}

.zodiacResult {
  font-size: 0.9rem;
  color: var(--cosmic-gold);
  font-weight: 600;
}

.hint {
  text-align: center;
  color: var(--cosmic-text-secondary);
  font-size: 0.9rem;
}

.spreadWrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.spread {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3.2rem, 1fr));
  gap: 0.5rem;
}

.cardBack {
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  border: 1px solid var(--cosmic-gold-soft);
  background: linear-gradient(160deg, #2a1a5e, #171034);
  color: var(--cosmic-gold);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.cardBack:hover {
  transform: translateY(-3px);
  border-color: var(--cosmic-gold);
}

.cardBackSymbol {
  color: var(--cosmic-gold);
}

.revealWrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.dragCard {
  width: 9rem;
  aspect-ratio: 2 / 3;
  border-radius: 14px;
  border: 1px solid var(--cosmic-gold-soft);
  background: linear-gradient(160deg, #2a1a5e, #171034);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--cosmic-gold);
  cursor: grab;
  touch-action: none;
  user-select: none;
  box-shadow: 0 0 24px rgba(224, 184, 79, 0.15);
}

.dragCard:active {
  cursor: grabbing;
}

.dragCardSnap {
  transition: transform 0.25s ease;
}

.directionHints {
  display: flex;
  gap: 1.25rem;
  font-size: 0.8rem;
  color: var(--cosmic-text-secondary);
}

.directionHintActive {
  color: var(--cosmic-gold);
  font-weight: 700;
}

.resultCard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.75rem;
  background: var(--cosmic-surface);
  border: 1px solid var(--cosmic-border);
  border-radius: 18px;
}

.cardImage {
  border-radius: 10px;
  box-shadow: 0 0 32px rgba(224, 184, 79, 0.25);
  border: 1px solid var(--cosmic-gold-soft);
}

.resultHeader {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: center;
}

.cardName {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--cosmic-gold);
}

.cardNameEn {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--cosmic-text-secondary);
}

.cardKeyword {
  font-size: 0.85rem;
  color: var(--cosmic-text-secondary);
}

.directionLabel {
  text-align: center;
  font-size: 0.8rem;
  color: var(--cosmic-text-secondary);
}

.fortuneText {
  text-align: center;
  font-size: 1rem;
  line-height: 1.6;
}

.interpretationText {
  text-align: center;
  font-size: 0.98rem;
  line-height: 1.7;
  color: var(--cosmic-text);
}

.spreadPickRow {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  width: 100%;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--cosmic-border);
}

.cardImageSmall {
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(224, 184, 79, 0.2);
  border: 1px solid var(--cosmic-gold-soft);
  flex-shrink: 0;
}

.spreadPickText {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: left;
}

.spreadPickText .directionLabel {
  text-align: left;
}

.positionLabel {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--cosmic-gold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fortuneTextSmall {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--cosmic-text);
}

.zodiacBlurb {
  text-align: center;
  font-size: 0.85rem;
  color: var(--cosmic-text-secondary);
}

.setsField {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: var(--cosmic-text-secondary);
  font-weight: 500;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  border: 1px solid var(--cosmic-border);
  border-radius: 999px;
  padding: 0.2rem;
}

.stepperButton {
  width: 1.7rem;
  height: 1.7rem;
  border: none;
  border-radius: 50%;
  background: var(--cosmic-gold-soft);
  color: var(--cosmic-text);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.stepperButton:hover:not(:disabled) {
  background: var(--cosmic-gold);
  color: #241a02;
}

.stepperButton:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stepperValue {
  width: 1.8rem;
  text-align: center;
  font-weight: 700;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.drawResultList {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.drawResultRow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--cosmic-border);
}

.drawResultRow:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.numbersRow {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ball {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  color: #ffffff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
}

.generateButton {
  align-self: center;
  padding: 0.75rem 1.6rem;
  border: none;
  border-radius: 999px;
  background: var(--cosmic-gold);
  color: #241a02;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.generateButton:hover:not(:disabled) {
  filter: brightness(1.1);
}

.generateButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resetButton {
  align-self: center;
  padding: 0.55rem 1.2rem;
  border: 1px solid var(--cosmic-border);
  border-radius: 999px;
  background: transparent;
  color: var(--cosmic-text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.resetButton:hover {
  color: var(--cosmic-text);
  border-color: var(--cosmic-gold);
}

.saveButton {
  align-self: center;
  padding: 0.5rem 1.1rem;
  border: 1px solid var(--cosmic-border);
  border-radius: 999px;
  background: transparent;
  color: var(--cosmic-gold);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.saveButton:hover:not(:disabled) {
  border-color: var(--cosmic-gold);
}

.saveButton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.saveError {
  font-size: 0.78rem;
  color: var(--cosmic-text-secondary);
  text-align: center;
}
```

- [ ] **Step 7: 타입체크 + 전체 프론트 테스트**

Run: `cd frontend && npx tsc --noEmit && npm test`
Expected: 타입 에러 없음, 모든 테스트 통과

- [ ] **Step 8: 브라우저 수동 검증**

로컬 백엔드+프론트를 띄우고 (`ANTHROPIC_API_KEY`를 `application-local.properties`에 실제 값으로 설정해야 AI 해석 모드까지 끝까지 테스트 가능):
1. `/tarot` 접속 → 모드 선택 화면에 3버튼과 각각의 남은 횟수가 보이는지 확인
2. "타로만 보기" → 카드 3장 뽑기 → "종합 해석 보기" 클릭 → 로딩 후 해석 문단이 표시되는지, 마이페이지 접속 없이도 홈에서 `progress.tarotUsage`가 소모됐는지(다시 모드 선택으로 돌아가 남은 횟수 텍스트 확인)
3. "생년월일로 별자리도 함께" → 동일 플로우 확인. 단, AI 해석 풀은 위와 공유되므로 이미 소진됐다면 429 에러 메시지가 뜨는지 확인
4. "번호 뽑기용 타로" → 생년월일 생략하고 바로 카드 뽑기 → 세트 수 조절(등급에 따라 고정/조절) → "번호 뽑기" → 번호 세트들이 뜨고 저장 버튼이 동작하는지 확인. AI 해석 횟수가 소진된 상태에서도 이 모드는 정상 동작해야 함

- [ ] **Step 9: Commit**

```bash
git add frontend/lib/tarotNumberGenerator.ts frontend/lib/tarotNumberGenerator.test.ts frontend/lib/progress.ts frontend/lib/progress.test.ts frontend/app/tarot/page.tsx frontend/app/tarot/page.module.css
git commit -m "Restructure /tarot into three modes: AI interpretation x2, number draw"
```

---

### Task 9: `/mypage` 타로 해석 기록 섹션 추가

**Files:**
- Modify: `frontend/app/mypage/page.tsx`
- Modify: `frontend/app/mypage/page.module.css`

**Interfaces:**
- Consumes: `getTarotInterpretationHistory`, `type TarotInterpretationResult`(Task 6)
- Produces: 없음 (이 브랜치의 마지막 태스크)

자동 테스트 없이 타입체크 + 브라우저 수동 검증으로 마무리한다 (기존 `/mypage`도 동일 컨벤션).

- [ ] **Step 1: `page.tsx`에 해석 기록 섹션 추가**

`frontend/app/mypage/page.tsx`의 import 블록을 다음으로 교체:

```tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { getSavedNumbers, type SavedNumberResult } from "../../lib/savedNumbers";
import { groupSavedNumbers } from "../../lib/groupSavedNumbers";
import { getBallColor } from "../../lib/lottoBall";
import { getTarotInterpretationHistory, type TarotInterpretationResult } from "../../lib/tarotInterpretation";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { getKakaoAuthorizeUrl } from "../../lib/auth";
```

`MyPage` 컴포넌트 내부, 기존 `savedNumbers`/`error` state 선언 바로 아래에 추가:

```tsx
  const [interpretations, setInterpretations] = useState<TarotInterpretationResult[]>([]);
  const [interpretationsError, setInterpretationsError] = useState<string | null>(null);
```

기존 `useEffect`(저장된 번호를 불러오는 부분)를 다음으로 교체:

```tsx
  useEffect(() => {
    if (!auth) return;
    getSavedNumbers(auth.token)
      .then(setSavedNumbers)
      .catch(() => setError("저장된 번호를 불러오지 못했습니다."));
    getTarotInterpretationHistory(auth.token)
      .then(setInterpretations)
      .catch(() => setInterpretationsError("타로 해석 기록을 불러오지 못했습니다."));
  }, [auth]);
```

`{error && <p className={styles.error}>{error}</p>}` 줄 바로 아래에 추가:

```tsx
      {interpretationsError && <p className={styles.error}>{interpretationsError}</p>}

      {interpretations.length > 0 && (
        <div className={styles.interpretationSection}>
          <h2 className={styles.monthLabel}>타로 해석 기록</h2>
          <div className={styles.interpretationList}>
            {interpretations.map((item) => (
              <div key={item.id} className={styles.interpretationCard}>
                <div className={styles.interpretationHeader}>
                  <span className={styles.sourceBadge}>
                    {item.mode === "TAROT_ONLY" ? "타로만 보기" : "별자리 함께보기"}
                  </span>
                  <span className={styles.itemMeta}>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</span>
                </div>
                <p className={styles.interpretationCards}>
                  {item.cards
                    .map((c) => (c.positionLabel ? `[${c.positionLabel}] ${c.nameKo}` : c.nameKo))
                    .join(" · ")}
                  {item.zodiacName ? ` · ${item.zodiacName}` : ""}
                </p>
                <p className={styles.interpretationText}>{item.interpretationText}</p>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 2: `page.module.css`에 스타일 추가**

`frontend/app/mypage/page.module.css` 끝에 추가:

```css
.interpretationSection {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.interpretationList {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.interpretationCard {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.interpretationHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.interpretationCards {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.interpretationText {
  font-size: 0.9rem;
  line-height: 1.6;
}
```

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 4: 브라우저 수동 검증**

`/mypage` 접속 → Task 8에서 생성한 AI 해석 기록이 "타로 해석 기록" 섹션에 최신순으로 표시되는지, 모드 라벨/카드 목록/별자리/해석문/날짜가 올바른지 확인.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/mypage/page.tsx frontend/app/mypage/page.module.css
git commit -m "Show tarot AI interpretation history on mypage"
```

---

## 배포 참고사항 (이 플랜 밖의 수동 작업)

- 이 브랜치를 머지하기 **전에** `db/migrations/0009_create_tarot_interpretations.sql`을 Supabase에 먼저 적용해야 한다 (`db/migrations/README.md` 규칙).
- Render 백엔드 환경변수에 `ANTHROPIC_API_KEY`를 추가해야 한다 (기존 `KAKAO_CLIENT_ID` 등과 동일한 방식으로 Render 대시보드에서 직접 추가).

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서(`docs/superpowers/specs/2026-07-26-tarot-ai-interpretation-design.md`)의 모드 재편/횟수 분리/AI 저장/마이페이지 이력/에러 처리 항목 모두 Task 1~9에 대응됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 류 문구 없음 — 모든 스텝에 완성된 코드 포함.
- **타입 일관성:** `TarotCardInput`/`TarotInterpretationMode`/`TarotInterpretationResult`(프론트)와 `TarotInterpretationRequest.CardInput`/`TarotInterpretationResponse`(백엔드)의 필드명이 카멜케이스로 1:1 대응됨 (`cardNumber`, `nameKo`, `keyword`, `direction`, `positionLabel`, `zodiacName`, `interpretationText`, `createdAt`) — JSON 직렬화 시 자동 매핑됨.
- **죽은 코드:** `consumeTarotUsage`(프론트)와 `POST /api/progress/tarot-usage`(백엔드), `generateTarotNumbers`/`generateTarotNumbersForPicks`/`buildWeightsForPicks`/`CardPick`(프론트)가 각각 이를 대체하는 태스크(5, 8)에서 함께 제거되도록 명시함 — 중간 커밋에서 컴파일/타입체크가 깨지지 않는 순서로 배치함.
