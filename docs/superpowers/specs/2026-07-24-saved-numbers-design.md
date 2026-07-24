# 번호 저장 + 마이페이지 (2단계) 설계

## 배경 및 목적

등급제/포인트 1단계(포인트·레벨업·일일 사용량 제한)가 완료됐다. 이번 스펙은 4단계 로드맵 중 2단계를 다룬다:

1. 포인트/레벨업/일일 사용량 제한 (완료)
2. **번호 저장 + 마이페이지** ← 이번 스펙
3. 당첨 확인 → "뽑기의 신" 승급
4. 구독/결제 (마스터 등급 즉시 부여)

3~4번은 각각 별도 스펙으로 이후에 진행한다. 이번 스펙에서 저장하는 번호에 대상 회차(`target_draw_no`)를 함께 기록해두는 이유는, 3단계에서 회차별 당첨 여부를 비교할 때 마이그레이션 없이 바로 쓸 수 있게 하기 위함이다.

## 범위

**포함:**
- `/generate`(번호생성)와 `/tarot`(타로) 양쪽에서 나온 번호 세트를 저장 가능하게 함
- 저장 시점 기준 "다음 추첨 회차"를 함께 기록
- `/mypage` 신설 — 저장된 번호를 저장일 기준 월별 → 주별로 그룹핑해서 조회

**제외:**
- 실제 당첨 여부 판정, "뽑기의 신" 승급 로직 (3단계)
- 구독/결제 (4단계)
- 저장 개수 제한 — 이미 하루 생성 횟수 자체가 등급별로 제한되므로 별도 제한 불필요

## 아키텍처

### 데이터 모델

새 테이블 `saved_numbers` (`db/migrations/0006_create_saved_numbers.sql`). 기존 `weekly_picks` 테이블 컨벤션을 따라 번호를 `num1~num6` 개별 컬럼으로 저장한다:

```sql
create table if not exists saved_numbers (
  id bigserial primary key,
  user_id bigint not null references users(id),
  source varchar(20) not null,
  target_draw_no integer not null,
  num1 integer not null,
  num2 integer not null,
  num3 integer not null,
  num4 integer not null,
  num5 integer not null,
  num6 integer not null,
  saved_at timestamptz not null default now()
);
```

`source`는 `'GENERATE'` 또는 `'TAROT'`. `target_draw_no`는 `WeeklyPickService`가 이미 사용 중인 방식과 동일하게 `lottoDrawRepository.findMaxDrawNo().orElse(0) + 1`로 계산한다(저장 시점 기준 다음 추첨 회차).

### 백엔드 (새 패키지 `com.lottopredictor.backend.savednumber`)

- **`SavedNumber` 엔티티**: `id`, `userId`, `source`, `targetDrawNo`, `num1~num6`, `savedAt`
- **`SavedNumberRepository`**: `findByUserIdOrderBySavedAtDesc(Long userId): List<SavedNumber>`
- **`SavedNumberService`**:
  - `save(Long userId, String source, List<Integer> numbers): SavedNumber` — `target_draw_no`를 계산해 저장
  - `getSaved(Long userId): List<SavedNumber>`
- **`SavedNumberController`**:
  - `POST /api/saved-numbers` (`@AuthPrincipal` 필수, body `{source, numbers}`) → 저장된 레코드를 DTO로 반환
  - `GET /api/saved-numbers` (`@AuthPrincipal` 필수) → 유저의 전체 저장 목록(최신순) 반환. 월별/주별 그룹핑은 프론트에서 처리

### 프론트엔드

- **`lib/savedNumbers.ts`** (신규):
  - `saveNumbers(source, numbers, token): Promise<SavedNumberResult>`
  - `getSavedNumbers(token): Promise<SavedNumberResult[]>`
- **`/generate` 페이지**: 각 결과 카드(`resultCard`, 세트가 여러 개면 카드마다 각각)에 "저장" 버튼 추가. 클릭 시 `saveNumbers("GENERATE", set, auth.token)` 호출 → 성공하면 그 카드만 "저장됨"으로 비활성화 표시(서버는 중복 저장을 막지 않음 — UI 레벨에서만 방지, 문제될 정도로 남용될 규모가 아님)
- **`/tarot` 페이지**: 번호 결과가 표시되는 지점에 동일하게 "저장" 버튼 추가, `saveNumbers("TAROT", numbers, auth.token)` 호출
- **`/mypage` 신규 페이지**: 로그인 안 됐으면 기존 페이지들과 동일한 패턴(안내 문구 + 카카오 로그인 버튼)을 보여준다. 로그인 상태면 `getSavedNumbers` 호출 후, `savedAt`을 기준으로 월별(예: "2026년 7월") → 그 안에서 주별(월요일 시작)로 그룹핑해서 표시. 각 항목에 번호 6개, 소스 배지(번호생성/타로), 대상 회차, 저장 일시를 보여준다
- **`Nav.tsx`**: 로그인 상태일 때만 `LINKS`와 별개로 "마이페이지" 링크 노출(로그아웃 상태에서는 안 보임)

## 에러 처리

- 미로그인 상태로 저장/조회 API를 직접 호출하는 경우 → 기존 `@AuthPrincipal` 패턴대로 401
- `/mypage` 목록 조회 실패 시 → 안내 문구 표시
- 저장 API 실패 시 → 해당 결과 카드에 짧은 에러 문구 표시, 버튼은 다시 활성화되어 재시도 가능

## 테스트

- **백엔드**: `SavedNumberService` 단위 테스트 — 저장 성공(반환값 필드 확인), `target_draw_no` 계산(기존 draw 유무에 따른 케이스), 저장 후 `getSaved`로 조회 시 포함되는지. `LottoDrawRepository`는 Mockito로 목 처리
- **프론트**: `lib/savedNumbers.ts` 유닛 테스트(성공/실패 응답 처리). 월별/주별 그룹핑 순수 함수에 대한 유닛 테스트(같은 달 다른 주, 다른 달 등 케이스). `/mypage`는 타입체크 + 브라우저 수동 확인(로그인 후 목록 표시, 그룹핑 정확성, 미로그인 시 안내 문구)
