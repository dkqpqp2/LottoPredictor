# 연금복권720+ 크롤러 (1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연금복권720+ 당첨 이력을 동행복권에서 가져와 DB에 저장하는 크롤러와 관리자 전용 수동 수집 트리거를 추가한다.

**Architecture:** 로또 크롤러(`DhLotteryClient` → `DhLotteryResponseParser` → `LottoCrawlerService`)와 같은 3단 구조를 새 `PensionDraw` 도메인에 대해 만든다. 연금복권 API(`GET /pt720/selectPstPt720WnList.do`)는 로또와 달리 전체 회차를 한 번에 반환하므로, 로또처럼 회차별 폴링 루프(`CrawlSyncService`)를 쓰지 않고 "DB에 없는 회차만 새로 저장"하는 단순한 로직으로 구현한다. 기존 `SyncResult`/`SkippedDraw` 타입은 이미 로또 전용이 아니라 범용이라 그대로 재사용한다.

**Tech Stack:** Spring Boot 4.1.0 (Java 21, Spring Data JPA), JUnit 5 + Mockito + AssertJ, Next.js 16 App Router (TypeScript).

## Global Constraints

- 연금복권 API 응답의 `wnBndNo`(조), `wnRnkVl`(당첨번호 6자리), `bnsRnkVl`(보너스번호 6자리)는 앞자리 0이 의미를 갖는다 — `number`/`bonusNumber` 필드는 정수 변환 없이 문자열 그대로 저장한다. `wnBndNo`만 항상 한 자리 숫자(1~5)라 정수로 파싱한다.
- 실제 API: `GET https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do` (파라미터 없음), 응답 형태 `{"data":{"result":[{"psltEpsd":..,"psltRflYmd":"...","wnBndNo":"...","wnRnkVl":"...","bnsRnkVl":"..."}]}}` — 1회차부터 최신 회차까지 전체를 한 번에 반환함(직접 호출로 확인, 현재 1~325회).
- `db/migrations/0010_create_pension_draws.sql`은 Supabase에 **수동으로, 백엔드 배포 전에** 적용해야 한다 (`spring.jpa.hibernate.ddl-auto=validate` 설정 때문에 순서가 바뀌면 백엔드 전체가 기동하지 않는다).
- 엔티티/리포지토리/컨트롤러는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 (기존 `LottoDraw`/`LottoDrawRepository`/`CrawlController`도 동일) — 컴파일 확인으로 충분하다.
- 관리자 전용 엔드포인트는 기존 패턴(`@Value("${admin.user-id}") Long adminUserId`와 `principal.userId()` 비교, 아니면 403)을 그대로 따른다.

---

### Task 1: `PensionDraw` 엔티티 + 리포지토리 + DB 마이그레이션

**Files:**
- Create: `db/migrations/0010_create_pension_draws.sql`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionDraw.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionDrawRepository.java`

**Interfaces:**
- Consumes: 없음
- Produces: `PensionDraw(Integer drawNo, LocalDate drawDate, Integer groupNo, String number, String bonusNumber)` 생성자, `getDrawNo()`, `getDrawDate()`, `getGroupNo()`, `getNumber()`, `getBonusNumber()`. `PensionDrawRepository.findMaxDrawNo(): Optional<Integer>`, `PensionDrawRepository.save(PensionDraw): PensionDraw` (JPA 기본 제공). Task 4에서 이 타입들을 그대로 사용한다.

이 태스크는 다른 태스크와 독립적이다. 전용 테스트는 없다 (Global Constraints 참고) — 컴파일 확인만 한다.

- [ ] **Step 1: `0010_create_pension_draws.sql` 작성**

```sql
create table if not exists pension_draws (
  draw_no integer primary key,
  draw_date date not null,
  group_no integer not null,
  number varchar(6) not null,
  bonus_number varchar(6) not null,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: `PensionDraw` 엔티티 작성**

```java
package com.lottopredictor.backend.pensiondraw;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "pension_draws")
public class PensionDraw {

    @Id
    @Column(name = "draw_no")
    private Integer drawNo;

    @Column(name = "draw_date", nullable = false)
    private LocalDate drawDate;

    @Column(name = "group_no", nullable = false)
    private Integer groupNo;

    @Column(name = "number", nullable = false)
    private String number;

    @Column(name = "bonus_number", nullable = false)
    private String bonusNumber;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    protected PensionDraw() {
    }

    public PensionDraw(Integer drawNo, LocalDate drawDate, Integer groupNo, String number, String bonusNumber) {
        this.drawNo = drawNo;
        this.drawDate = drawDate;
        this.groupNo = groupNo;
        this.number = number;
        this.bonusNumber = bonusNumber;
    }

    public Integer getDrawNo() {
        return drawNo;
    }

    public LocalDate getDrawDate() {
        return drawDate;
    }

    public Integer getGroupNo() {
        return groupNo;
    }

    public String getNumber() {
        return number;
    }

    public String getBonusNumber() {
        return bonusNumber;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
```

- [ ] **Step 3: `PensionDrawRepository` 작성**

```java
package com.lottopredictor.backend.pensiondraw;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface PensionDrawRepository extends JpaRepository<PensionDraw, Integer> {

    @Query("select max(d.drawNo) from PensionDraw d")
    Optional<Integer> findMaxDrawNo();
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`, 에러 없음

- [ ] **Step 5: Commit**

```bash
git add db/migrations/0010_create_pension_draws.sql backend/src/main/java/com/lottopredictor/backend/pensiondraw/
git commit -m "Add PensionDraw entity, repository, and DB migration"
```

---

### Task 2: 연금복권 API 응답 파서

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionEntry.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionResponse.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/crawler/PensionDrawData.java`
- Create: `backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionResponseParser.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/crawler/DhPensionResponseParserTest.java`

**Interfaces:**
- Consumes: 없음
- Produces: `PensionDrawData(int drawNo, LocalDate drawDate, int groupNo, String number, String bonusNumber)` record. `DhPensionResponseParser.parse(DhPensionResponse response): List<PensionDrawData>` — 항목이 하나라도 결측 필드면 그 항목만 결과에서 제외한다. Task 3(`DhPensionClient`)과 Task 4(`PensionCrawlerService`)가 이 타입들을 그대로 사용한다.

이 태스크는 다른 태스크와 독립적이다 — 순수 파싱 로직만 다룬다.

- [ ] **Step 1: `PensionDrawData` record 작성**

```java
package com.lottopredictor.backend.crawler;

import java.time.LocalDate;

public record PensionDrawData(
        int drawNo,
        LocalDate drawDate,
        int groupNo,
        String number,
        String bonusNumber
) {
}
```

- [ ] **Step 2: `DhPensionEntry`/`DhPensionResponse` record 작성**

```java
package com.lottopredictor.backend.crawler;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DhPensionEntry(
        Integer psltEpsd,
        String psltRflYmd,
        String wnBndNo,
        String wnRnkVl,
        String bnsRnkVl
) {
}
```

```java
package com.lottopredictor.backend.crawler;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DhPensionResponse(DhPensionData data) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DhPensionData(List<DhPensionEntry> result) {
    }
}
```

- [ ] **Step 3: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/crawler/DhPensionResponseParserTest.java`:

```java
package com.lottopredictor.backend.crawler;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DhPensionResponseParserTest {

    @Test
    void parsesAllEntriesInTheList() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(List.of(
                new DhPensionEntry(325, "20260723", "3", "011391", "438906"),
                new DhPensionEntry(324, "20260716", "2", "485216", "061918")
        )));

        List<PensionDrawData> draws = DhPensionResponseParser.parse(response);

        assertThat(draws).hasSize(2);
        PensionDrawData first = draws.get(0);
        assertThat(first.drawNo()).isEqualTo(325);
        assertThat(first.drawDate()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(first.groupNo()).isEqualTo(3);
        assertThat(first.number()).isEqualTo("011391");
        assertThat(first.bonusNumber()).isEqualTo("438906");
    }

    @Test
    void preservesLeadingZerosInTheNumberFields() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(List.of(
                new DhPensionEntry(1, "20200102", "1", "000001", "000002")
        )));

        List<PensionDrawData> draws = DhPensionResponseParser.parse(response);

        assertThat(draws.get(0).number()).isEqualTo("000001");
        assertThat(draws.get(0).bonusNumber()).isEqualTo("000002");
    }

    @Test
    void skipsEntriesWithAMissingField() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(List.of(
                new DhPensionEntry(325, null, "3", "011391", "438906"),
                new DhPensionEntry(324, "20260716", "2", "485216", "061918")
        )));

        List<PensionDrawData> draws = DhPensionResponseParser.parse(response);

        assertThat(draws).hasSize(1);
        assertThat(draws.get(0).drawNo()).isEqualTo(324);
    }

    @Test
    void returnsEmptyListWhenDataIsNull() {
        DhPensionResponse response = new DhPensionResponse(null);

        assertThat(DhPensionResponseParser.parse(response)).isEmpty();
    }

    @Test
    void returnsEmptyListWhenResultIsNull() {
        DhPensionResponse response = new DhPensionResponse(new DhPensionResponse.DhPensionData(null));

        assertThat(DhPensionResponseParser.parse(response)).isEmpty();
    }
}
```

- [ ] **Step 4: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.crawler.DhPensionResponseParserTest"`
Expected: FAIL (컴파일 에러 — `DhPensionResponseParser` 클래스가 아직 없음)

- [ ] **Step 5: `DhPensionResponseParser` 구현 작성**

```java
package com.lottopredictor.backend.crawler;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public final class DhPensionResponseParser {

    private DhPensionResponseParser() {
    }

    public static List<PensionDrawData> parse(DhPensionResponse response) {
        List<PensionDrawData> result = new ArrayList<>();
        if (response.data() == null || response.data().result() == null) {
            return result;
        }

        for (DhPensionEntry entry : response.data().result()) {
            PensionDrawData data = parseEntry(entry);
            if (data != null) {
                result.add(data);
            }
        }
        return result;
    }

    private static PensionDrawData parseEntry(DhPensionEntry entry) {
        if (entry.psltEpsd() == null
                || entry.psltRflYmd() == null
                || entry.wnBndNo() == null
                || entry.wnRnkVl() == null
                || entry.bnsRnkVl() == null) {
            return null;
        }

        return new PensionDrawData(
                entry.psltEpsd(),
                LocalDate.parse(entry.psltRflYmd(), DateTimeFormatter.BASIC_ISO_DATE),
                Integer.parseInt(entry.wnBndNo()),
                entry.wnRnkVl(),
                entry.bnsRnkVl()
        );
    }
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.crawler.DhPensionResponseParserTest"`
Expected: `BUILD SUCCESSFUL`, 5개 테스트 전부 통과

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionEntry.java backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionResponse.java backend/src/main/java/com/lottopredictor/backend/crawler/PensionDrawData.java backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionResponseParser.java backend/src/test/java/com/lottopredictor/backend/crawler/DhPensionResponseParserTest.java
git commit -m "Add parser for the pension lottery draw list API response"
```

---

### Task 3: `DhPensionClient`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionClient.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/crawler/DhPensionClientTest.java`

**Interfaces:**
- Consumes: Task 2의 `DhPensionResponse`, `PensionDrawData`, `DhPensionResponseParser.parse(DhPensionResponse): List<PensionDrawData>`
- Produces: `DhPensionClient.fetchAll(): List<PensionDrawData>` — HTTP 요청 실패 시 `RestClientException`이 그대로 전파된다(별도 Result 래퍼 없음 — 이 API는 로또와 달리 "특정 회차가 아직 안 뽑힘" 같은 상태가 없고 전체 목록을 한 번에 받아오므로, 성공(파싱된 리스트) 또는 예외 두 가지뿐이다). Task 4(`PensionCrawlerService`)가 이 메서드를 그대로 호출한다.

이 태스크는 Task 2에 의존한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/crawler/DhPensionClientTest.java`:

```java
package com.lottopredictor.backend.crawler;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DhPensionClientTest {

    private static final String SUCCESS_BODY = """
            {
              "resultCode": null,
              "resultMessage": null,
              "data": {
                "result": [
                  { "psltEpsd": 325, "psltRflYmd": "20260723", "wnBndNo": "3", "wnRnkVl": "011391", "bnsRnkVl": "438906" },
                  { "psltEpsd": 324, "psltRflYmd": "20260716", "wnBndNo": "2", "wnRnkVl": "485216", "bnsRnkVl": "061918" }
                ]
              }
            }
            """;

    private DhPensionClient buildClientBackedBy(MockRestServiceServer[] serverOut) {
        RestClient.Builder builder = RestClient.builder();
        serverOut[0] = MockRestServiceServer.bindTo(builder).build();
        return new DhPensionClient(builder);
    }

    @Test
    void returnsAllParsedDrawsOnSuccess() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhPensionClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do"))
                .andRespond(withSuccess(SUCCESS_BODY, MediaType.APPLICATION_JSON));

        List<PensionDrawData> draws = client.fetchAll();

        assertThat(draws).hasSize(2);
        assertThat(draws.get(0).drawNo()).isEqualTo(325);
        assertThat(draws.get(0).number()).isEqualTo("011391");
    }

    @Test
    void propagatesAnExceptionOnHttpFailure() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhPensionClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do"))
                .andRespond(withServerError());

        assertThatThrownBy(client::fetchAll).isInstanceOf(RestClientException.class);
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.crawler.DhPensionClientTest"`
Expected: FAIL (컴파일 에러 — `DhPensionClient` 클래스가 아직 없음)

- [ ] **Step 3: `DhPensionClient` 구현 작성**

```java
package com.lottopredictor.backend.crawler;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

@Component
public class DhPensionClient {

    private static final String URL = "https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do";

    private final RestClient restClient;

    public DhPensionClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    public List<PensionDrawData> fetchAll() {
        DhPensionResponse response = restClient.get()
                .uri(URL)
                .retrieve()
                .body(DhPensionResponse.class);

        if (response == null) {
            return List.of();
        }

        return DhPensionResponseParser.parse(response);
    }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.crawler.DhPensionClientTest"`
Expected: `BUILD SUCCESSFUL`, 2개 테스트 전부 통과

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionClient.java backend/src/test/java/com/lottopredictor/backend/crawler/DhPensionClientTest.java
git commit -m "Add DhPensionClient for fetching pension lottery draw data"
```

---

### Task 4: `PensionCrawlerService`

**Files:**
- Create: `backend/src/main/java/com/lottopredictor/backend/crawler/PensionCrawlerService.java`
- Test: `backend/src/test/java/com/lottopredictor/backend/crawler/PensionCrawlerServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `PensionDraw`, `PensionDrawRepository`(`findMaxDrawNo()`, `save()`). Task 2의 `PensionDrawData`. Task 3의 `DhPensionClient.fetchAll()`. 기존 `SyncResult`(`record SyncResult(List<Integer> synced, List<SkippedDraw> skipped)`, `backend/src/main/java/com/lottopredictor/backend/crawler/SyncResult.java`, 이미 존재 — 수정 없음)
- Produces: `PensionCrawlerService.syncLatestDraws(): SyncResult`. Task 5(`CrawlController`)가 이 메서드를 그대로 호출한다.

이 태스크는 Task 1, 2, 3에 의존한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/lottopredictor/backend/crawler/PensionCrawlerServiceTest.java`:

```java
package com.lottopredictor.backend.crawler;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PensionCrawlerServiceTest {

    @Mock
    private PensionDrawRepository repository;

    @Mock
    private DhPensionClient client;

    @Test
    void savesOnlyDrawsNewerThanTheCurrentMax() {
        when(repository.findMaxDrawNo()).thenReturn(Optional.of(323));
        when(client.fetchAll()).thenReturn(List.of(
                new PensionDrawData(325, LocalDate.of(2026, 7, 23), 3, "011391", "438906"),
                new PensionDrawData(324, LocalDate.of(2026, 7, 16), 2, "485216", "061918"),
                new PensionDrawData(323, LocalDate.of(2026, 7, 9), 4, "604270", "945893")
        ));

        PensionCrawlerService service = new PensionCrawlerService(repository, client);
        SyncResult result = service.syncLatestDraws();

        assertThat(result.synced()).containsExactlyInAnyOrder(324, 325);
        assertThat(result.skipped()).isEmpty();
        verify(repository, times(2)).save(any(PensionDraw.class));
    }

    @Test
    void savesNothingWhenAllDrawsAreAlreadyStored() {
        when(repository.findMaxDrawNo()).thenReturn(Optional.of(325));
        when(client.fetchAll()).thenReturn(List.of(
                new PensionDrawData(325, LocalDate.of(2026, 7, 23), 3, "011391", "438906")
        ));

        PensionCrawlerService service = new PensionCrawlerService(repository, client);
        SyncResult result = service.syncLatestDraws();

        assertThat(result.synced()).isEmpty();
        verify(repository, never()).save(any());
    }

    @Test
    void savesEverythingWhenNoDrawsAreStoredYet() {
        when(repository.findMaxDrawNo()).thenReturn(Optional.empty());
        when(client.fetchAll()).thenReturn(List.of(
                new PensionDrawData(2, LocalDate.of(2020, 1, 9), 1, "000002", "111111"),
                new PensionDrawData(1, LocalDate.of(2020, 1, 2), 5, "000001", "222222")
        ));

        PensionCrawlerService service = new PensionCrawlerService(repository, client);
        SyncResult result = service.syncLatestDraws();

        assertThat(result.synced()).containsExactlyInAnyOrder(1, 2);
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.crawler.PensionCrawlerServiceTest"`
Expected: FAIL (컴파일 에러 — `PensionCrawlerService` 클래스가 아직 없음)

- [ ] **Step 3: `PensionCrawlerService` 구현 작성**

```java
package com.lottopredictor.backend.crawler;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class PensionCrawlerService {

    private final PensionDrawRepository repository;
    private final DhPensionClient client;

    public PensionCrawlerService(PensionDrawRepository repository, DhPensionClient client) {
        this.repository = repository;
        this.client = client;
    }

    public SyncResult syncLatestDraws() {
        int currentMax = repository.findMaxDrawNo().orElse(0);
        List<Integer> synced = new ArrayList<>();

        for (PensionDrawData data : client.fetchAll()) {
            if (data.drawNo() > currentMax) {
                repository.save(new PensionDraw(
                        data.drawNo(),
                        data.drawDate(),
                        data.groupNo(),
                        data.number(),
                        data.bonusNumber()
                ));
                synced.add(data.drawNo());
            }
        }

        return new SyncResult(synced, List.of());
    }
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.lottopredictor.backend.crawler.PensionCrawlerServiceTest"`
Expected: `BUILD SUCCESSFUL`, 3개 테스트 전부 통과

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/crawler/PensionCrawlerService.java backend/src/test/java/com/lottopredictor/backend/crawler/PensionCrawlerServiceTest.java
git commit -m "Add PensionCrawlerService to sync new draws into the database"
```

---

### Task 5: 관리자 수동 수집 트리거 (백엔드 엔드포인트 + 프론트 UI)

**Files:**
- Modify: `backend/src/main/java/com/lottopredictor/backend/api/CrawlController.java`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/admin/page.tsx`

**Interfaces:**
- Consumes: Task 4의 `PensionCrawlerService.syncLatestDraws(): SyncResult`. 기존 `SyncResult` 프론트 타입(`frontend/lib/api.ts`의 `export interface SyncResult { synced: number[]; skipped: SkippedDraw[]; }`, 이미 존재 — 수정 없음, 그대로 재사용)
- Produces: 없음 (이 플랜의 마지막 태스크)

이 태스크는 Task 4에 의존한다. 컨트롤러/페이지는 이 코드베이스 컨벤션상 전용 테스트 없음 — 전체 빌드 + 타입체크 + 브라우저 수동 확인으로 검증한다.

- [ ] **Step 1: `CrawlController`에 연금복권 엔드포인트 추가**

`backend/src/main/java/com/lottopredictor/backend/api/CrawlController.java` 전체를 다음으로 교체:

```java
package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.crawler.LottoCrawlerService;
import com.lottopredictor.backend.crawler.PensionCrawlerService;
import com.lottopredictor.backend.crawler.SyncResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CrawlController {

    private final LottoCrawlerService crawlerService;
    private final PensionCrawlerService pensionCrawlerService;
    private final Long adminUserId;

    public CrawlController(
            LottoCrawlerService crawlerService,
            PensionCrawlerService pensionCrawlerService,
            @Value("${admin.user-id}") Long adminUserId
    ) {
        this.crawlerService = crawlerService;
        this.pensionCrawlerService = pensionCrawlerService;
        this.adminUserId = adminUserId;
    }

    @PostMapping("/api/crawl")
    public ResponseEntity<SyncResult> crawl(@AuthPrincipal AuthenticatedUser principal) {
        if (!adminUserId.equals(principal.userId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(crawlerService.syncLatestDraws());
    }

    @PostMapping("/api/crawl/pension")
    public ResponseEntity<SyncResult> crawlPension(@AuthPrincipal AuthenticatedUser principal) {
        if (!adminUserId.equals(principal.userId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(pensionCrawlerService.syncLatestDraws());
    }
}
```

- [ ] **Step 2: 프론트 `lib/api.ts`에 `triggerPensionCrawl` 추가**

`frontend/lib/api.ts`에서 기존 `triggerCrawl` 함수(아래) 바로 뒤에 추가:

```ts
export async function triggerCrawl(token: string): Promise<SyncResult> {
  const res = await fetch(`${API_BASE_URL}/api/crawl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) {
    throw new Error("관리자 계정만 이용할 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("크롤링 요청에 실패했습니다.");
  }
  return res.json();
}
```

추가할 코드:

```ts
export async function triggerPensionCrawl(token: string): Promise<SyncResult> {
  const res = await fetch(`${API_BASE_URL}/api/crawl/pension`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) {
    throw new Error("관리자 계정만 이용할 수 있어요.");
  }
  if (!res.ok) {
    throw new Error("크롤링 요청에 실패했습니다.");
  }
  return res.json();
}
```

- [ ] **Step 3: 관리자 페이지에 "연금복권 회차 수집" 섹션 추가**

`frontend/app/admin/page.tsx`의 5번째 줄:

```ts
import { triggerCrawl, type SyncResult } from "../../lib/api";
```

를 다음으로 교체:

```ts
import { triggerCrawl, triggerPensionCrawl, type SyncResult } from "../../lib/api";
```

22-24번째 줄(기존 로또 크롤링 state) 바로 뒤에 연금복권용 state 추가:

```ts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
```

를 다음으로 교체:

```ts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  const [pensionLoading, setPensionLoading] = useState(false);
  const [pensionError, setPensionError] = useState<string | null>(null);
  const [pensionResult, setPensionResult] = useState<SyncResult | null>(null);
```

`handleCollect` 함수(42-55번째 줄) 바로 뒤에 연금복권용 핸들러 추가:

```ts
  async function handleCollect() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await triggerCrawl(auth.token);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }
```

바로 뒤에 추가:

```ts
  async function handleCollectPension() {
    if (!auth) return;
    setPensionLoading(true);
    setPensionError(null);
    setPensionResult(null);
    try {
      const data = await triggerPensionCrawl(auth.token);
      setPensionResult(data);
    } catch (err) {
      setPensionError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setPensionLoading(false);
    }
  }
```

기존 "회차 수집" `<section>` 블록(118-157번째 줄) 바로 뒤, "회원 관리" `<section>` 앞에 새 섹션 추가:

```tsx
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>연금복권 회차 수집</h2>
        <p className={styles.subtitle}>
          실행하면 DB에 없는 연금복권720+ 회차를 전부 새로 가져옵니다. 이미 최신 상태면 아무 일도 일어나지 않습니다.
        </p>

        <button
          type="button"
          className={styles.collectButton}
          onClick={handleCollectPension}
          disabled={pensionLoading}
        >
          {pensionLoading ? "수집 중..." : "수집하기"}
        </button>

        {pensionError && <p className={styles.error}>{pensionError}</p>}

        {pensionResult && (
          <div className={styles.resultBox}>
            <div className={styles.resultStat}>
              <span className={styles.resultCount}>{pensionResult.synced.length}</span>
              <span className={styles.resultLabel}>개 회차 수집됨</span>
            </div>
            {pensionResult.synced.length > 0 && (
              <div className={styles.syncedList}>
                {pensionResult.synced.map((n) => (
                  <span key={n} className={styles.syncedBadge}>
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
```

- [ ] **Step 4: 백엔드 전체 빌드 + 프론트 타입체크**

Run: `cd backend && ./gradlew test`
Expected: `BUILD SUCCESSFUL`, 전체 테스트 통과 (기존 테스트 + 이 플랜에서 추가한 테스트 전부)

Run: `cd frontend && npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 5: 브라우저에서 관리자 페이지 수동 확인**

로컬에서 백엔드/프론트 둘 다 띄우고 관리자 계정으로 `/admin`에 접속해서: "연금복권 회차 수집" 섹션이 "회차 수집" 섹션 아래, "회원 관리" 섹션 위에 보이는지, "수집하기" 버튼을 누르면 로딩 상태를 거쳐 결과(수집된 회차 개수 + 배지 목록)가 나오는지 확인한다. **주의: 이 확인 전에 Task 1의 `0010_create_pension_draws.sql`을 로컬/개발 DB에 먼저 적용해야 한다** (안 하면 백엔드가 `ddl-auto=validate` 스키마 검증에서 실패해 아예 기동하지 않는다).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/lottopredictor/backend/api/CrawlController.java frontend/lib/api.ts frontend/app/admin/page.tsx
git commit -m "Add admin trigger for the pension lottery crawler"
```

---

## 배포 참고사항 (이 플랜 밖의 수동 작업)

- **`db/migrations/0010_create_pension_draws.sql`을 Supabase에 먼저 적용한 뒤** 백엔드를 배포한다. 순서를 바꾸면 스키마 검증 실패로 로또/타로 등 기존 기능을 포함한 백엔드 전체가 기동하지 않는다.
- 이 단계는 관리자 화면에서만 보이는 기능이라, 마이그레이션 적용 후 배포하면 일반 사용자에게 노출되는 변경은 없다.

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서의 엔티티/마이그레이션(Task 1), API 파서(Task 2), 클라이언트(Task 3), 크롤러 서비스(Task 4), 관리자 트리거(Task 5) 전부 태스크로 반영됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 없음 — 전 스텝에 실제 코드/명령어 포함.
- **타입 일관성:** `PensionDrawData`(Task 2에서 정의: `drawNo, drawDate, groupNo, number, bonusNumber`)를 Task 3(`DhPensionClient.fetchAll()`)과 Task 4(`PensionCrawlerService`)가 동일한 필드명/순서로 사용. `PensionDraw` 생성자 인자 순서(Task 1: `drawNo, drawDate, groupNo, number, bonusNumber`)와 Task 4에서 `new PensionDraw(data.drawNo(), data.drawDate(), data.groupNo(), data.number(), data.bonusNumber())` 호출 순서가 일치함을 확인함. `SyncResult`는 기존 타입을 그대로 재사용하며 어떤 태스크도 그 정의를 변경하지 않음.
- **기존 코드 영향 범위 확인:** `CrawlSyncService`, `FetchDrawResult`, `LottoDraw`, `LottoDrawRepository`, `LottoCrawlerService` 등 로또 크롤러 관련 기존 파일은 이 플랜에서 전혀 수정하지 않는다 — `CrawlController`만 수정하되 기존 `/api/crawl` 엔드포인트/로직은 그대로 두고 새 엔드포인트만 추가함.
- **빌드 도구 오탐 수정:** 초안에서는 이 프로젝트가 Maven(`./mvnw`)을 쓴다고 잘못 가정하고 전 태스크의 테스트/컴파일 명령어를 그렇게 적었으나, `backend/build.gradle`·`backend/gradlew` 존재를 확인해 실제로는 Gradle임을 발견 — 모든 명령어를 `./gradlew compileJava` / `./gradlew test --tests "패키지.전체.경로.클래스명"` / `./gradlew test`로 교체함.
