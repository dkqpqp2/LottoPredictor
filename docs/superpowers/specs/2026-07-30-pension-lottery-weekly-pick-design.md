# 연금복권720+ 최근 당첨번호 + 이번주 추천 + 지난 이력 (5단계) 설계

## 배경 및 목적

로또는 `/generate` 페이지에 "최근 당첨번호", "이번주 추천 번호", "지난 추천 이력" 세 섹션을 로그인 없이 누구나 볼 수 있는 공용 기능으로 제공한다 (`weekly_picks` 테이블, `WeeklyPickService`). 연금복권720+는 1~4단계에서 크롤러/생성/뽑기 화면/저장-매칭까지 만들었지만 이 "공용 추천 + 이력" 기능은 아직 없다. 이번 5단계는 로또와 동일한 패턴으로 연금복권에도 이 기능을 추가한다.

## 범위

**포함:**
- 사이트 전체가 공유하는 "이번주 연금복권 추천 번호" (로그인 불필요, 유저별 아님 — 이미 만든 유저별 `pension_saved_numbers`와는 완전히 별개)
- 최근 실제 연금복권 당첨번호 표시 (이걸 위한 공개 조회 엔드포인트가 현재 없어서 신규 추가)
- 지난 추천 이력 (최근 5개, 페이지네이션 없음 — 로또와 동일)
- `/pension` 페이지에 위 세 섹션 추가

**제외:**
- 유저별 개인화된 추천 (기존 `pension_saved_numbers`가 이미 담당)
- 회차/날짜로 특정 회차 조회하는 기능 (로또 `DrawController`에는 있지만 지금 아무 화면도 쓰지 않음 — YAGNI)
- 관리자 트리거/스케줄러 (로또처럼 요청 시점에 지연 생성)

## 설계 결정

**왜 공용/비로그인인가:** 로또의 "이번주 추천"이 처음부터 공용 기능으로 설계된 것과 같은 이유 — 사이트를 처음 방문한 비로그인 사용자에게도 "이번주엔 이 번호가 추천됩니다"를 보여주는 마케팅적 성격의 기능이다. 로그인한 유저의 개인 뽑기 기록(`pension_saved_numbers`)과는 목적이 다르다 (사용자 결정 사항).

**왜 새 테이블을 처음부터 surrogate id + unique target_draw_no로 만드는가:** 로또의 `weekly_picks`는 원래 `week_start date primary key`로 만들었다가, 실제 추첨 결과가 이미 나왔는데도 다음 월요일까지 낡은 추천이 계속 표시되는 버그가 있어서 마이그레이션 0008(`weekly_picks_advance_on_resolve.sql`)로 `id bigserial` PK + `target_draw_no unique` 제약으로 바꿨다. 연금복권은 이 버그를 처음부터 피하기 위해 같은 최종 스키마로 바로 만든다.

**왜 새 로직 없이 기존 서비스를 재사용하는가:** 번호 생성은 2단계의 `PensionNumberGenerationService.generate()`(완전 랜덤, `PensionDrawRepository`에 의존하지 않는 순수 생성)를 그대로 쓴다. 등수 판정은 4단계의 `PensionMatchCalculator.calculate()`(실제 동행복권 1~7등+보너스 규칙)를 그대로 쓴다. 둘 다 이미 검증된 로직이라 새로 만들 이유가 없다.

**왜 "최근 당첨번호"용 신규 엔드포인트가 필요한가:** 로또는 `/generate` 페이지가 이미 존재하는 `GET /api/draws?page=0&size=1`(범용 회차 조회 엔드포인트, `DrawController`)을 호출해서 최신 회차를 가져온다. 연금복권은 1단계에서 크롤러와 `PensionDrawRepository`만 만들었을 뿐, 이 데이터를 프론트에 공개하는 엔드포인트가 전혀 없다 (기존에 있는 건 관리자 전용 `POST /api/crawl/pension`뿐). 그래서 로또 `DrawController`를 부분적으로 미러링한 `GET /api/pension/draws?page=&size=`를 새로 추가한다 — 로또 쪽에 있는 회차번호/날짜 조회 파라미터는 현재 어떤 화면도 필요로 하지 않으므로 페이지네이션 목록 기능만 가져온다.

## 아키텍처

### 데이터 모델: `pension_weekly_picks` (신규)

```sql
create table if not exists pension_weekly_picks (
  id bigserial primary key,
  week_start date not null,
  target_draw_no integer not null unique,
  group_no integer not null,
  number varchar(6) not null,
  created_at timestamptz not null default now()
);
```

`PensionWeeklyPick` 엔티티 (신규 패키지 `com.lottopredictor.backend.pensionweeklypick`): `id`, `weekStart`, `targetDrawNo`, `groupNo`, `number`, `createdAt`. 로또의 `mode`(weighted/random) 컬럼은 없음 — 연금복권은 완전 랜덤 하나뿐이라 저장할 값이 없다.

`PensionWeeklyPickRepository`:
```java
Optional<PensionWeeklyPick> findTopByOrderByIdDesc();
List<PensionWeeklyPick> findByIdLessThanOrderByIdDesc(Long id, Pageable pageable);
```

### `PensionWeeklyPickService` (신규)

로또 `WeeklyPickService`와 동일한 구조:

```
getCurrent(): PensionWeeklyPickResult
  repository.findTopByOrderByIdDesc()
    .filter(pick -> !isResolved(pick))
    .orElseGet(() -> generateAndSave(currentWeekStart()))
  → toResult(pick)

getHistory(limit): List<PensionWeeklyPickResult>
  현재 pick의 id보다 작은 것들을 findByIdLessThanOrderByIdDesc로 조회 (limit은 1~20 사이로 clamp, 로또와 동일)

isResolved(pick): pensionDrawRepository.existsById(pick.getTargetDrawNo())

generateAndSave(weekStart):
  targetDrawNo = pensionDrawRepository.findMaxDrawNo().orElse(0) + 1
  generated = pensionNumberGenerationService.generate()   // 2단계 서비스 그대로 재사용
  저장 후 반환

toResult(pick):
  pensionDrawRepository.findById(pick.targetDrawNo)
    있으면 → PensionMatchCalculator.calculate(pick.groupNo, pick.number, draw)로 등수/보너스 계산 (4단계 로직 그대로 재사용)
    없으면 → pending 응답
```

`PensionWeeklyPickResult` (신규 응답 record):
```java
public record PensionWeeklyPickResult(
        LocalDate weekStart,
        int targetDrawNo,
        int groupNo,
        String number,
        boolean resultAvailable,
        String rank,
        Boolean bonusMatch,
        Integer actualGroupNo,
        String actualNumber,
        String actualBonusNumber,
        String actualDrawDate
) {
    public static PensionWeeklyPickResult pending(LocalDate weekStart, int targetDrawNo, int groupNo, String number) {
        return new PensionWeeklyPickResult(
                weekStart, targetDrawNo, groupNo, number, false, null, null, null, null, null, null
        );
    }
}
```

### `PensionWeeklyPickController` (신규)

```
GET /api/pension/weekly-pick           → service.getCurrent()
GET /api/pension/weekly-pick/history?limit=5  → service.getHistory(limit)
```

로또 `WeeklyPickController`와 동일하게 완전 비로그인 — `@AuthPrincipal` 없음.

### 최근 당첨번호 조회: `GET /api/pension/draws` (신규)

로또 `DrawController`의 페이지네이션 목록 기능만 미러링:

```java
@RestController
@RequestMapping("/api/pension/draws")
public class PensionDrawController {
    @GetMapping
    public List<PensionDrawResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return pensionDrawRepository.findAllByOrderByDrawNoDesc(PageRequest.of(page, size))
                .stream().map(PensionDrawResponse::from).toList();
    }
}
```

`PensionDrawRepository`에 `findAllByOrderByDrawNoDesc(Pageable): List<PensionDraw>` 메서드를 추가한다 (기존 `findMaxDrawNo()` 옆에).

`PensionDrawResponse` (신규):
```java
public record PensionDrawResponse(
        int drawNo,
        LocalDate drawDate,
        int groupNo,
        String number,
        String bonusNumber
) {
    public static PensionDrawResponse from(PensionDraw draw) {
        return new PensionDrawResponse(
                draw.getDrawNo(), draw.getDrawDate(), draw.getGroupNo(), draw.getNumber(), draw.getBonusNumber()
        );
    }
}
```

### 프론트

`frontend/lib/api.ts`에 로또의 `WeeklyPickResult`/`getWeeklyPick`/`getWeeklyPickHistory`가 이미 정의된 것과 나란히 추가:
- `PensionWeeklyPickResult` 인터페이스, `getPensionWeeklyPick(): Promise<PensionWeeklyPickResult>`, `getPensionWeeklyPickHistory(limit = 5): Promise<PensionWeeklyPickResult[]>`
- `PensionDrawResult` 인터페이스, `getPensionDraws(params): Promise<PensionDrawResult[]>` (로또 `getDraws`와 같은 패턴, `page`/`size`만 지원)

`frontend/app/pension/page.tsx`: 뽑기 버튼(기존 카드) 위에 세 섹션 추가, `/generate` 페이지의 `weeklyCard`/`historyCard` 구조를 그대로 가져오되 로또 공 대신 텍스트("N조 XXXXXX")로 표시:
- **최근 당첨번호**: `getPensionDraws({page:0, size:1})`로 가져온 최신 회차의 조/번호/보너스번호/추첨일
- **이번주 추천**: `getPensionWeeklyPick()` 결과 — 대상 회차, 조+번호, 대기중이면 "…추첨 결과를 기다리는 중입니다", 결과 있으면 등수(없으면 "낙첨") + 보너스 당첨 여부
- **지난 추천 이력**: `getPensionWeeklyPickHistory(5)` 결과를 리스트로, 각 항목에 조+번호와 상태("대기중" 또는 등수/낙첨) 표시

모두 로그인 여부와 무관하게 페이지 진입 시 즉시 fetch (기존 `/pension`의 로그인 게이트 로직과는 독립적 — 뽑기 버튼만 로그인 필요, 이 세 섹션은 비로그인도 보임).

## 데이터 흐름

```
/pension 페이지 진입 (로그인 여부 무관)
  → GET /api/pension/draws?page=0&size=1        → 최근 당첨번호 카드
  → GET /api/pension/weekly-pick                → 이번주 추천 카드
      → 저장된 마지막 추천의 대상 회차가 이미 크롤링되어 있으면
        그 자리에서 새 추천을 생성해 저장하고 반환 (지연 생성)
      → 아니면 기존 추천을 그대로 반환 (대기중 또는 등수 계산해서 반환)
  → GET /api/pension/weekly-pick/history?limit=5 → 지난 추천 이력 리스트
```

## 에러 처리

- 세 엔드포인트 모두 인증 없음 — 실패 시나리오는 일반적인 네트워크/서버 오류뿐 (로또 `WeeklyPickController`/`DrawController`와 동일한 수준, 별도 에러 처리 없음)
- 프론트에서 각 fetch 실패 시 해당 섹션만 조용히 비우거나 일반 에러 메시지 표시 (기존 `/generate` 페이지의 처리 방식과 동일한 패턴을 따름 — 구현 계획 단계에서 `/generate`의 실제 에러 처리 코드를 확인해서 그대로 반영)

## 테스트

- `PensionWeeklyPickServiceTest`: 기존 `WeeklyPickServiceTest`와 같은 패턴 — 최초 생성, 대상 회차 미해결 시 기존 pick 재사용, 대상 회차 해결 시 다음 pick 자동 생성, 히스토리 조회가 현재 pick을 제외하고 최대 limit개 반환하는지 검증
- 컨트롤러/엔티티/리포지토리는 이 코드베이스 컨벤션상 전용 테스트 없음 — 컴파일 확인 + 전체 테스트 스위트로 검증
- `/pension` 페이지는 전용 테스트 없음 — 타입체크 + 브라우저 확인 (비로그인 상태에서 세 섹션이 정상 표시되는지는 실제로 검증 가능한 부분)

## 영향받는 파일

- `db/migrations/0012_create_pension_weekly_picks.sql` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPick.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickRepository.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickResult.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensionweeklypick/PensionWeeklyPickService.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionDrawRepository.java` — 수정 (`findAllByOrderByDrawNoDesc` 추가)
- `backend/src/main/java/com/lottopredictor/backend/api/PensionWeeklyPickController.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/api/PensionDrawController.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/api/PensionDrawResponse.java` — 신규
- `frontend/lib/api.ts` — 수정 (연금복권 weekly-pick/draws 관련 타입·함수 추가)
- `frontend/app/pension/page.tsx` — 수정 (세 섹션 추가)
- `frontend/app/pension/page.module.css` — 수정 (필요한 클래스 추가, `/generate`의 `generate.module.css` 클래스 재사용 가능한 건 재사용)

## 배포 참고사항

**`0012_create_pension_weekly_picks.sql`을 Supabase에 먼저 적용한 뒤에 배포**해야 한다 (`spring.jpa.hibernate.ddl-auto=validate` 설정 때문에 순서가 바뀌면 스키마 검증 실패로 백엔드 전체가 기동하지 않음 — 이전 단계들과 동일한 주의사항).
