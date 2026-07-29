# 연금복권720+ 저장/마이페이지 매칭 (4단계) 설계

## 배경 및 목적

1~3단계에서 연금복권720+ 크롤러(1단계), 완전 랜덤 번호 생성 + 진행도 연동(2단계), 프론트 뽑기 화면(3단계)을 만들었다. 이번 4단계는 뽑은 번호를 저장하고, 실제 추첨 결과와 비교해 등수를 보여주는 마지막 단계다. 이걸로 연금복권720+ 기능이 로또와 대등한 완성도(뽑기 → 저장 → 결과 확인)를 갖추게 된다.

## 범위

**포함:**
- 연금복권 뽑기 결과 자동 저장 (사용자가 버튼을 누를 필요 없이, 뽑는 즉시 저장)
- 동행복권 공식 등수 규칙(1~7등 + 보너스)에 따른 실제 당첨 매칭
- `/mypage`에 연금복권 뽑은 번호 섹션 추가 (월별로 넘겨보기, 기존 저장한 번호/타로 해석 기록과 같은 패턴)

**제외:**
- 없음 — 이걸로 연금복권720+ 기능 전체(1~4단계)가 완성된다.

## 설계 결정

**왜 새 테이블인가:** 기존 `saved_numbers` 테이블은 로또 번호(`num1`~`num6`, 1~45 사이 정수 6개) 구조로 설계되어 있어서, 연금복권의 "조 1~5 + 6자리 문자열(앞자리 0 의미 있음)" 구조와 전혀 맞지 않는다. 3단계 이전에 `TarotInterpretation`을 별도 테이블/엔티티/서비스/컨트롤러로 완전히 독립시킨 선례와 같은 이유로, `pension_saved_numbers`라는 새 테이블을 만든다. 기존 로또/타로 저장 코드는 전혀 건드리지 않는다.

**왜 자동 저장인가:** 연금복권은 하루 1회만 뽑을 수 있고 "세트" 개념도 없어서, 로또/타로처럼 여러 결과 중 원하는 것만 골라 저장하는 흐름이 애초에 맞지 않는다 (이전에 타로 "번호 뽑기용" 화면도 같은 이유로 자동 저장으로 바꾼 선례가 있음). 뽑은 즉시 자동으로 저장한다 (사용자 결정 사항).

**왜 백엔드에서 원자적으로 처리하는가:** `GET /api/pension/generate` 엔드포인트 자체가 번호 생성과 저장을 한 트랜잭션 성격의 한 요청 안에서 처리한다. 프론트가 생성 API 호출 후 별도로 저장 API를 또 호출하는 2단계 구조였다면, 네트워크 오류로 두 호출 사이가 끊기면 "뽑았는데 저장 안 됨" 상태가 생길 수 있다. 원자적 처리로 이 문제 자체를 없앤다 (사용자 결정 사항). 이 때문에 `PensionSavedNumberController`는 `SavedNumberController`(POST+GET 쌍)와 달리 `GET`만 있고 `POST`가 없다 — 저장은 항상 `/api/pension/generate` 내부에서만 일어난다.

**왜 `PensionNumberGenerationService`는 그대로 두는가:** 2단계에서 이미 "순수 독립 난수 생성, `PensionDrawRepository`에 의존하지 않음"이 설계 결정으로 확정되어 있다. 저장에는 `PensionDrawRepository.findMaxDrawNo()`(대상 회차 계산용)가 필요하므로, 저장 로직은 새 `PensionSavedNumberService`에 두고 `PensionGenerateController`가 두 서비스를 조합한다. 생성 서비스 자체는 이번 단계에서 전혀 수정하지 않는다.

**실제 당첨 등수 규칙 (동행복권 공식 안내 페이지에서 직접 확인함):**

| 등수 | 조건 |
|------|------|
| 1등 | 조 + 6자리 번호 전부 일치 |
| 2등 | 조 무관, 6자리 번호 전부 일치 |
| 3등 | 뒤에서부터 연속 5자리 일치 |
| 4등 | 뒤에서부터 연속 4자리 일치 |
| 5등 | 뒤에서부터 연속 3자리 일치 |
| 6등 | 뒤에서부터 연속 2자리 일치 |
| 7등 | 뒤에서부터 연속 1자리 일치 |
| 보너스 | 조 무관, 뽑은 6자리 번호가 보너스번호(`bonusNumber`)와 전부 일치 |

등수(1~7등)는 항상 당첨번호(`number`)와 비교하고, 보너스는 별도로 보너스번호(`bonusNumber`)와 비교한다 — 서로 독립적인 판정이라 한 티켓이 등수(예: 4등)와 보너스 당첨을 동시에 받을 수도 있다 (실제 방송에서도 "2등 8명·보너스 2명"처럼 별도 인원으로 집계됨).

## 아키텍처

### `PensionSavedNumber` 엔티티 + 마이그레이션 (신규, 패키지 `com.lottopredictor.backend.pensionsavednumber`)

```java
@Entity
@Table(name = "pension_saved_numbers")
public class PensionSavedNumber {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long userId;
    private Integer targetDrawNo;
    private Integer groupNo;
    private String number;   // 6자리, 문자열 그대로 (앞자리 0 보존)
    private Instant savedAt;
}
```

`db/migrations/0011_create_pension_saved_numbers.sql`:

```sql
create table if not exists pension_saved_numbers (
  id bigserial primary key,
  user_id bigint not null,
  target_draw_no integer not null,
  group_no integer not null,
  number varchar(6) not null,
  saved_at timestamptz not null
);
```

`SavedNumber`와 달리 `source` 컬럼이 없다 (연금복권 저장은 항상 `/pension` 뽑기 한 곳에서만 발생하므로 출처를 구분할 필요가 없음).

### `PensionMatchCalculator` (신규, 패키지 `com.lottopredictor.backend.pensiondraw` — `LottoMatchCalculator`가 `draw` 패키지에 있는 것과 같은 배치)

```java
public final class PensionMatchCalculator {
    public record MatchResult(String rank, boolean bonusMatch) {}

    public static MatchResult calculate(int pickedGroupNo, String pickedNumber, PensionDraw draw) {
        int suffixLen = commonSuffixLength(pickedNumber, draw.getNumber());
        String rank;
        if (suffixLen == 6) {
            rank = pickedGroupNo == draw.getGroupNo() ? "1등" : "2등";
        } else {
            rank = switch (suffixLen) {
                case 5 -> "3등";
                case 4 -> "4등";
                case 3 -> "5등";
                case 2 -> "6등";
                case 1 -> "7등";
                default -> null;
            };
        }
        boolean bonusMatch = pickedNumber.equals(draw.getBonusNumber());
        return new MatchResult(rank, bonusMatch);
    }

    private static int commonSuffixLength(String a, String b) {
        int len = 0;
        for (int i = 1; i <= 6; i++) {
            if (a.charAt(6 - i) == b.charAt(6 - i)) {
                len++;
            } else {
                break;
            }
        }
        return len;
    }
}
```

`number`/`draw.getNumber()`/`draw.getBonusNumber()`는 항상 정확히 6자로 보장된다 (생성 시 `%06d` 포맷, 크롤러 저장 시 `varchar(6) not null` — 1단계/2단계에서 이미 확정된 불변식).

### `PensionSavedNumberService` (신규)

```
save(userId, groupNo, number): PensionSavedNumberResponse
  targetDrawNo = pensionDrawRepository.findMaxDrawNo().orElse(0) + 1
  저장 후 toResponse()로 변환해 반환

getSaved(userId): List<PensionSavedNumberResponse>
  findByUserIdOrderBySavedAtDesc(userId) 전부 toResponse()

toResponse(entity):
  pensionDrawRepository.findById(entity.targetDrawNo)로 결과 회차 조회
  있으면 PensionMatchCalculator.calculate()로 등수/보너스 계산해 "available" 응답
  없으면 "pending" 응답 (resultAvailable = false)
```

`SavedNumberResponse`와 같은 pending/available 패턴:

```java
public record PensionSavedNumberResponse(
        Long id,
        int targetDrawNo,
        int groupNo,
        String number,
        Instant savedAt,
        boolean resultAvailable,
        String rank,
        Boolean bonusMatch,
        Integer actualGroupNo,
        String actualNumber,
        String actualBonusNumber,
        String actualDrawDate
) {
    public static PensionSavedNumberResponse pending(
            Long id, int targetDrawNo, int groupNo, String number, Instant savedAt
    ) {
        return new PensionSavedNumberResponse(
                id, targetDrawNo, groupNo, number, savedAt, false, null, null, null, null, null, null
        );
    }
}
```

### `PensionGenerateController` 수정

```
GET /api/pension/generate (기존 엔드포인트, 응답 형태 PensionGenerateResult 그대로 유지)
  usageService.consume(userId, PENSION) — 실패 시 429 (기존과 동일)
  result = generationService.generate()
  pensionSavedNumberService.save(userId, result.groupNo(), result.number())  ← 신규: 같은 요청 안에서 저장
  return result
```

### `PensionSavedNumberController` (신규)

```
GET /api/pension/saved-numbers  →  pensionSavedNumberService.getSaved(userId)
```

`POST`가 없다 (저장은 `/api/pension/generate` 내부에서 이미 처리됨 — 위 "설계 결정" 참고).

### 프론트

`frontend/lib/pensionSavedNumbers.ts` (신규):

```ts
export interface PensionSavedNumberResult {
  id: number;
  targetDrawNo: number;
  groupNo: number;
  number: string;
  savedAt: string;
  resultAvailable: boolean;
  rank: string | null;
  bonusMatch: boolean | null;
  actualGroupNo: number | null;
  actualNumber: string | null;
  actualBonusNumber: string | null;
  actualDrawDate: string | null;
}

export async function getPensionSavedNumbers(token: string): Promise<PensionSavedNumberResult[]> {
  // GET /api/pension/saved-numbers, Authorization 헤더
}
```

`save...()` 함수는 없다 — 저장은 이미 백엔드에서 자동으로 일어나므로 프론트가 호출할 저장 API 자체가 없다. `/pension/page.tsx`는 이번 단계에서 전혀 수정하지 않는다.

`frontend/app/mypage/page.tsx`: 기존 "저장한 번호"/"타로 해석 기록" 섹션과 나란히 "연금복권 뽑은 번호" 섹션을 추가한다. 같은 `viewYear`/`viewMonth` 월 네비게이션을 공유하고, 자체 페이지 상태(`pensionPage`)로 페이지네이션한다. 각 항목은 로또처럼 색깔 공이 아니라 텍스트로 표시한다 (조/자릿수 개념은 공 은유가 안 맞음):

```
내 번호: 3조 011391
{targetDrawNo}회 대상 · {savedAt 날짜}
(결과 있으면) 당첨: 3조 011391 (보너스 485216) · 1등  /  낙첨
(bonusMatch면 별도로) · 보너스 당첨
```

## 데이터 흐름

```
사용자가 /pension에서 "연금복권 번호 뽑기" 클릭 (기존 3단계 플로우, 변경 없음)
  → GET /api/pension/generate
      → usageService.consume(userId, PENSION) — 이미 오늘 사용했으면 429
      → PensionNumberGenerationService.generate() → { groupNo, number }
      → PensionSavedNumberService.save(userId, groupNo, number)   ← 신규
          → targetDrawNo = 다음 회차
          → PensionSavedNumber 저장
      → { groupNo, number } 응답 (기존과 동일한 응답 형태)
  → 프론트는 기존 3단계 애니메이션/결과 카드 그대로 표시 (저장 관련 추가 호출 없음)

사용자가 /mypage 방문
  → GET /api/pension/saved-numbers
      → 저장된 각 항목에 대해 대상 회차 크롤링 데이터가 있는지 확인
      → 있으면 PensionMatchCalculator로 등수/보너스 계산해 포함
  → "연금복권 뽑은 번호" 섹션에 월별로 표시
```

## 에러 처리

- 저장 실패(DB 오류 등): 기존 `saveNumberRepository.save()`/컨트롤러 계층과 동일한 수준 — 이 코드베이스는 저장 실패를 별도로 감싸 처리하지 않고 예외를 그대로 전파해 500 응답 (로또 `SavedNumberService`와 동일한 컨벤션)
- 대상 회차 결과가 아직 없음(크롤링 전): `resultAvailable: false`로 표시, 에러 아님 (로또와 동일한 "pending" 패턴)
- `/api/pension/saved-numbers` 호출 실패(네트워크 등): "저장된 번호를 불러오지 못했습니다." 같은 일반 에러 메시지 (기존 `getSavedNumbers` 패턴과 동일)

## 테스트

- `PensionMatchCalculatorTest`: 기존 `LottoMatchCalculatorTest`(`backend/src/test/java/com/lottopredictor/backend/draw/LottoMatchCalculatorTest.java`)와 같은 스타일의 순수 단위 테스트. 1등(조+6자리 전부 일치), 2등(6자리만 일치·조 다름), 3~7등(뒤에서부터 5/4/3/2/1자리 일치), 무당첨(0자리 일치), 보너스 단독 일치, 등수+보너스 동시 당첨 케이스를 각각 검증한다.
- `PensionSavedNumberServiceTest`: 기존 `SavedNumberServiceTest`(`backend/src/test/java/com/lottopredictor/backend/savednumber/SavedNumberServiceTest.java`)와 같은 패턴 — `@ExtendWith(MockitoExtension.class)`로 `PensionSavedNumberRepository`/`PensionDrawRepository`를 목 처리해, 저장 시 `targetDrawNo`가 `findMaxDrawNo()+1`(회차 없으면 1)로 계산되는지, 대상 회차 결과가 있을 때/없을 때 각각 올바른 응답이 나오는지 검증한다.
- 컨트롤러/엔티티/리포지토리는 이 코드베이스 컨벤션상 전용 테스트를 작성하지 않는다 — 컴파일 확인 + 전체 테스트 스위트로 검증
- 프론트 `lib/pensionSavedNumbers.ts`: 기존 `lib/savedNumbers.ts`/`api.test.ts` 테스트와 같은 스타일로 fetch 호출/헤더/에러 케이스 검증
- `/mypage` 페이지 자체는 이 코드베이스 컨벤션상 전용 테스트 없음 (기존 마이페이지 섹션들과 동일) — 타입체크 + 브라우저 수동 확인으로 검증

## 영향받는 파일

- `db/migrations/0011_create_pension_saved_numbers.sql` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumber.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberRepository.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberResponse.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensionsavednumber/PensionSavedNumberService.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/pensiondraw/PensionMatchCalculator.java` — 신규
- `backend/src/main/java/com/lottopredictor/backend/api/PensionGenerateController.java` — 수정 (저장 호출 추가)
- `backend/src/main/java/com/lottopredictor/backend/api/PensionSavedNumberController.java` — 신규
- `frontend/lib/pensionSavedNumbers.ts` — 신규
- `frontend/app/mypage/page.tsx` — 수정 ("연금복권 뽑은 번호" 섹션 추가)
- `frontend/app/mypage/page.module.css` — 수정 (필요 시 최소한의 클래스 추가, 기존 클래스 최대한 재사용)

## 배포 참고사항

**`0011_create_pension_saved_numbers.sql`을 Supabase에 먼저 적용한 뒤에 배포**해야 한다 (`spring.jpa.hibernate.ddl-auto=validate` 설정 때문에 순서가 바뀌면 스키마 검증 실패로 백엔드 전체가 기동하지 않음 — 1단계와 동일한 주의사항).
