# 연금복권720+ 크롤러 + DB 설계 (1단계)

## 배경 및 목적

로또 6/45 랜덤 뽑기에 이어 연금복권720+ 랜덤 뽑기 기능을 추가하기로 했다. 연금복권은 로또와 완전히 다른 상품(조 1~5 + 6자리 번호, 등수는 뒷자리 매칭 방식)이라 로또 인프라를 그대로 재사용할 수 없고, 처음부터 크롤러/DB/생성기/프론트/저장-매칭까지 로또와 대등한 규모의 작업이 될 것으로 예상되어 단계별로 나눠 진행한다. 이 문서는 그중 1단계 — 실제 당첨 이력을 가져와 DB에 저장하는 크롤러 — 를 다룬다.

## 범위

**포함:**
- 연금복권720+ 당첨 이력을 동행복권에서 가져와 DB에 저장하는 크롤러
- 관리자 전용 수동 수집 트리거 (기존 로또 크롤링과 동일한 패턴)

**제외 (다음 단계로 미룸):**
- 번호 생성(통계 기반 가중치 또는 완전 랜덤) — 2단계
- 진행도/횟수(등급별 일일 제한) 연동 — 2단계
- 프론트 뽑기 화면 — 3단계
- 저장된 번호 매칭/등수 표시 — 4단계

## 아키텍처

### 실제 API 확인 결과

동행복권 사이트(`dhlottery.co.kr`)에서 로또 6/45가 쓰는 것과 같은 패턴의 비공식 JSON API를 연금복권720+도 제공한다. 직접 호출해서 확인했다:

```
GET https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do
```

응답 형태:
```json
{
  "data": {
    "result": [
      { "psltEpsd": 325, "psltRflYmd": "20260723", "wnBndNo": "3", "wnRnkVl": "011391", "bnsRnkVl": "438906" },
      { "psltEpsd": 324, "psltRflYmd": "20260716", "wnBndNo": "2", "wnRnkVl": "485216", "bnsRnkVl": "061918" }
    ]
  }
}
```

이 엔드포인트는 로또처럼 회차 하나씩 조회하는 방식이 아니라, **1회차부터 최신 회차(현재 325회)까지 전체를 한 번의 호출로 반환**한다 (직접 호출해서 최소/최대 회차와 전체 개수를 확인함: 1~325, 총 325건). 따라서 로또 크롤러처럼 "최신 회차+1부터 순서대로 폴링"하는 반복 로직이 필요 없고, 매번 전체 목록을 받아서 DB에 없는 회차만 새로 저장하면 된다.

필드 의미:
- `psltEpsd`: 회차 번호
- `psltRflYmd`: 추첨일 (`YYYYMMDD`)
- `wnBndNo`: 당첨 조 (`"1"`~`"5"`, 문자열이지만 항상 한 자리 숫자라 정수로 파싱 가능)
- `wnRnkVl`: 당첨번호 6자리 (예: `"011391"`)
- `bnsRnkVl`: 보너스번호 6자리

**주의:** `wnRnkVl`/`bnsRnkVl`은 앞자리 0이 의미를 가지는 6자리 코드다 (`"011391"`을 정수로 바꾸면 `11391`이 되어 자릿수 정보가 사라진다). 따라서 엔티티/DTO 전 구간에서 정수 변환 없이 **문자열 그대로** 다룬다.

### 엔티티: `PensionDraw`

로또의 `LottoDraw`(패키지 `com.lottopredictor.backend.draw`)와 나란히, 새 패키지 `com.lottopredictor.backend.pensiondraw`에 추가한다.

```java
package com.lottopredictor.backend.pensiondraw;

@Entity
@Table(name = "pension_draws")
public class PensionDraw {
    @Id
    private Integer drawNo;          // psltEpsd
    private LocalDate drawDate;      // psltRflYmd 파싱
    private Integer groupNo;         // wnBndNo 파싱 (1~5)
    private String number;           // wnRnkVl, 6자리 문자열 그대로
    private String bonusNumber;      // bnsRnkVl, 6자리 문자열 그대로
    private Instant createdAt;       // DB 기본값
}
```

`LottoDraw`와 동일하게 `drawNo`가 PK고, JPA 컨벤션(기본 생성자 protected, getter, 생성자)도 그대로 따른다.

### DB 마이그레이션

`db/migrations/0010_create_pension_draws.sql` (기존 마이그레이션은 `db/migrations/`에 순번으로 쌓여 있고 Supabase에 수동 적용하는 방식 — `db/migrations/README.md` 참고). 이번 마이그레이션도 동일한 방식: **백엔드를 배포하기 전에 이 SQL을 먼저 Supabase에 적용**해야 한다 (순서가 바뀌면 `spring.jpa.hibernate.ddl-auto=validate` 설정 때문에 스키마 검증 실패로 백엔드 전체가 기동하지 않는다 — 로또/타로 등 기존 기능도 함께 영향받는다).

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

### 크롤러

로또 크롤러(`DhLotteryClient` → `DhLotteryResponseParser` → `LottoCrawlerService`)와 같은 3단 구조를 그대로 따르되, 폴링 루프(`CrawlSyncService`)는 필요 없다 (위에서 설명한 것처럼 API 자체가 전체 목록을 한 번에 주기 때문).

- `DhPensionClient` — `GET /pt720/selectPstPt720WnList.do` 호출, 파라미터 없음
- `DhPensionResponse`/`DhPensionEntry` — JSON 응답 매핑용 record (기존 `DhLotteryResponse`/`DhLotteryDrawEntry`와 같은 스타일)
- `PensionDrawData` — 파싱된 도메인 데이터 record (`drawNo`, `drawDate`, `groupNo`, `number`, `bonusNumber`)
- `DhPensionResponseParser` — `DhPensionResponse` → `List<PensionDrawData>`. 필드가 하나라도 비어있는 항목은 걸러낸다 (로또 파서와 같은 방어적 처리)
- `PensionCrawlerService` — `repository.findMaxDrawNo()`보다 큰 회차만 걸러서 저장하고, 새로 저장한 회차 번호 목록을 기존 `SyncResult`(로또 전용 타입이 아니라 `record SyncResult(List<Integer> synced, List<SkippedDraw> skipped)`로 이미 범용) 그대로 담아 반환한다. 이 태스크에서는 `skipped`는 항상 빈 리스트다 (파서가 이미 걸러낸 항목은 애초에 목록에 없으므로 "실패 사유"를 따로 보고할 대상이 없다).

### 관리자 트리거

기존 `CrawlController`(`POST /api/crawl` → 로또 크롤링, 관리자 전용)에 새 엔드포인트를 나란히 추가한다:

```
POST /api/crawl/pension
```

기존 `/api/crawl`과 동일한 관리자 검증(`adminUserId` 비교, 아니면 403)을 거친다.

프론트 관리자 페이지(`/admin`)에는 기존 "회차 수집" 섹션과 똑같은 패턴으로 "연금복권 회차 수집" 섹션을 하나 더 추가한다 (버튼 + 로딩 상태 + 결과/에러 표시, 별도 state로 관리).

## 데이터 흐름

```
관리자가 "연금복권 회차 수집" 버튼 클릭
  → POST /api/crawl/pension (관리자 인증)
  → PensionCrawlerService.syncLatestDraws()
      → DhPensionClient가 전체 회차 목록 조회 (1회 호출)
      → DhPensionResponseParser가 파싱, 결측 필드 있는 항목 제거
      → repository.findMaxDrawNo()보다 큰 회차만 저장
  → SyncResult(synced: 새로 저장된 회차 번호들, skipped: 항상 빈 리스트) 응답
```

## 에러 처리

- 네트워크 요청 실패(동행복권 서버 장애 등): `RestClientException` 발생 시 그대로 예외 전파 → 컨트롤러 레벨에서 500 응답 (기존 로또 크롤러가 명시적으로 별도 처리하지 않는 것과 동일한 수준 — 이 프로젝트 컨벤션상 크롤러 실패는 관리자가 응답 상태로 확인하고 재시도하는 방식)
- 응답 파싱 실패(예상 못한 필드 누락): 해당 항목만 건너뛰고 나머지는 정상 처리
- 이미 DB에 있는 회차: 조용히 건너뜀 (재실행해도 안전 — 로또 크롤러와 동일한 멱등성)

## 테스트

- `DhPensionResponseParserTest` — 실제 API 응답 형태를 흉내낸 샘플 JSON으로 정상 파싱 + 결측 필드 항목 제거 검증 (로또 파서 테스트와 같은 패턴)
- `PensionCrawlerServiceTest` — 리포지토리를 목(mock)으로 두고, 이미 저장된 최대 회차보다 큰 것만 저장되는지, `SyncResult.synced`에 정확히 새로 저장된 회차 번호가 담기는지 검증
- 엔티티/리포지토리/컨트롤러는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 (기존 `LottoDraw`/`LottoDrawRepository`/`CrawlController`도 동일) — 컴파일 확인 + 전체 빌드로 검증

## 영향받는 파일

- `db/migrations/0010_create_pension_draws.sql` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionDraw.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionDrawRepository.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionClient.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionResponse.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionEntry.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/crawler/PensionDrawData.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/crawler/DhPensionResponseParser.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/crawler/PensionCrawlerService.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/api/CrawlController.java` — 수정 (`POST /api/crawl/pension` 추가)
- `frontend/lib/api.ts` — 수정 (`triggerPensionCrawl` 추가)
- `frontend/app/admin/page.tsx` — 수정 ("연금복권 회차 수집" 섹션 추가)

## 배포 참고사항

이번 단계는 관리자 화면에서만 보이는 크롤링 기능이라 일반 사용자에게 노출되는 변경은 없다. 단, **`0010_create_pension_draws.sql`을 Supabase에 먼저 적용한 뒤에 배포**해야 한다 (위 "DB 마이그레이션" 섹션 참고).
