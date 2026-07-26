# 타로 AI 종합 해석 설계

## 배경 및 목적

`/tarot` 페이지는 현재 두 모드(타로만 보기 / 생년월일로 별자리도 함께 보기)를 제공하는데, 둘 다 카드를 뽑으면 미리 저장된 짧은 한 줄 운세(`fortunes`)를 보여준 뒤 "번호 뽑기" 버튼으로 로또 번호를 생성하는 흐름이다. 등급제/포인트 설계 당시 "타로는 모든 등급 하루 1회로 제한한다"는 결정을 미리 내려둔 이유가 바로 이 스펙 — AI가 카드 조합을 종합 해석해주는 기능을 붙이면 호출당 비용이 발생하기 때문이었다.

이번 스펙은 그 AI 종합 해석 기능을 추가하면서, 기존 두 모드의 역할을 "운세 해석"과 "번호 생성"으로 분리한다.

## 범위

**포함:**
- 기존 두 모드(타로만 보기 / 별자리)에서 번호 생성 기능을 제거하고, 카드 공개 후 "종합 해석 보기" 버튼으로 AI가 생성한 해석 문단을 보여줌
- 신규 모드 "번호 뽑기용 타로" 추가 — 기존 번호 생성 로직(카드+방향+별자리 가중치)을 그대로 재사용하되, 등급별 세트 수(`maxSets`)까지 뽑을 수 있도록 확장
- AI 해석 결과를 DB에 저장하고 `/mypage`에서 이력 조회 가능하게 함
- 세 모드가 서로 다른 하루 사용 횟수 풀을 쓰도록 정리 (AI 해석 = `Feature.TAROT`, 번호 생성 = `Feature.GENERATE`)

**제외:**
- 사용자가 직접 질문 주제(연애/재물 등)를 입력하는 기능 — 카드만으로 종합 해석 (YAGNI, 필요해지면 추후 스펙)
- 해석 스트리밍(타이핑 효과) — 최초 버전은 완료된 텍스트를 한 번에 반환
- 번호용 타로에 여러 장 뽑기 — 기존과 동일하게 카드 1장만 뽑음(세트 수만 여러 개)

## 아키텍처

### 모드 재편 (프론트엔드)

`/tarot` 진입 시 모드 선택 화면이 3버튼으로 바뀐다. 각 버튼은 자신이 속한 횟수 풀의 남은 횟수를 표시한다.

| 모드 | 카드 | 별자리 입력 | 결과 | 소모 횟수 |
|---|---|---|---|---|
| 타로만 보기 | 3장 (과거/현재/미래) | 없음 | AI 종합 해석 | `Feature.TAROT` (전 등급 1/일) |
| 생년월일로 별자리도 함께 | 1장 | 필수 | AI 종합 해석 | `Feature.TAROT` (전 등급 1/일) |
| 번호 뽑기용 타로 *(신규)* | 1장 | 선택 (행운번호 가중치용) | 로또 번호 `maxSets`세트 | `Feature.GENERATE` (등급별) |

카드 공개(드래그로 뒤집기)와 리셋/리셔플은 계속 무료·무제한이다. 비용/횟수가 소모되는 시점은 정확히 두 곳뿐이다:
- "종합 해석 보기" 버튼 클릭 (AI 해석 모드) — **AI 호출이 실패하면 횟수를 소모하지 않는다.**
- "번호 뽑기" 버튼 클릭 (번호용 타로 모드) — 기존 `/generate`, 기존 타로와 동일하게 클릭 시점에 즉시 소모.

기존에 있던 "오늘 타로 횟수를 다 썼으면 페이지 전체를 막는" 전역 게이트는 제거한다. 이제 횟수 풀이 둘로 나뉘었으므로, AI 해석 횟수를 다 썼어도 번호 뽑기용 타로는 정상적으로 쓸 수 있어야 한다. 대신 모드 선택 화면의 각 버튼에 남은 횟수를 표시해 사용자가 미리 알 수 있게 하고, 실제로 소진된 모드에 들어가서 액션을 시도하면(해석 보기/번호 뽑기 버튼) 기존과 동일한 429 에러 메시지를 보여준다.

### 번호 뽑기용 타로 (프론트엔드 + 백엔드)

기존 `generateTarotNumbers`/`generateTarotNumbersForPicks`(가중치 계산, 클라이언트 로직)를 그대로 재사용한다. 다만 한 번에 여러 세트를 뽑아야 하므로, 동일 가중치 분포에서 `weightedSampleWithoutReplacement`를 `maxSets`번 독립적으로 호출해 세트 배열을 만드는 헬퍼를 추가한다 (세트 간 번호 중복 허용 — `/generate`도 세트마다 독립 샘플링이라 동일한 정책).

횟수 소모는 `Feature.GENERATE` 풀을 그대로 쓴다. 그런데 `/api/generate`는 서버가 직접 번호까지 생성해서 돌려주므로 이 흐름엔 맞지 않는다 — 번호용 타로는 카드 기반 가중치로 클라이언트가 직접 번호를 계산해야 하기 때문이다. 따라서 기존 `POST /api/progress/tarot-usage`(횟수만 소모하고 `ProgressResponse`를 반환하는 패턴)와 동일한 방식으로 `POST /api/progress/generate-usage`를 추가해 `Feature.GENERATE`만 소모시킨다. `ProgressController`에 메서드 하나만 추가하면 되고 `UsageService`/`TierPolicy`는 변경이 필요 없다.

### AI 종합 해석 (백엔드)

새 패키지 `com.lottopredictor.backend.tarotinterpretation`:

- **`TarotInterpretation` 엔티티**: `id`, `userId`, `mode`(`TAROT_ONLY` / `WITH_ZODIAC`), `cardsJson`(카드번호+방향+포지션라벨 JSON 문자열), `zodiac`(nullable), `interpretationText`, `createdAt`
- **`TarotInterpretationRepository`**: `findByUserIdOrderByCreatedAtDesc(Long userId): List<TarotInterpretation>`
- **`ClaudeTarotInterpreter`**: 공식 Anthropic Java SDK(`com.anthropic:anthropic-java`)로 `client.messages().create(...)` 호출. 모델은 `claude-sonnet-5`. 시스템 프롬프트로 톤(따뜻하고 재미로 보는 타로 상담사, 3~5문장 한 단락, 카드들을 하나의 이야기로 엮기)을 고정하고, 유저 메시지에 모드/카드/방향/포지션/별자리 정보를 구조화해서 전달
- **`TarotInterpretationService`**:
  - `interpret(Long userId, TarotInterpretationRequest): TarotInterpretation` — `usageService.consume(userId, Feature.TAROT)` 성공 시에만 `ClaudeTarotInterpreter` 호출, AI 호출이 예외를 던지면 소모된 횟수를 원복(같은 트랜잭션에서 `DailyUsage` 롤백) 후 예외를 그대로 던져 컨트롤러가 502로 응답하게 함. 성공하면 결과를 저장 후 반환
  - `getHistory(Long userId): List<TarotInterpretation>`
- **`TarotInterpretationController`**:
  - `POST /api/tarot/interpretation` (`@AuthPrincipal` 필수, body에 모드/카드 배열/별자리) → 429(횟수 소진) / 502(AI 호출 실패) / 200(성공 시 해석 텍스트 + 갱신된 `ProgressResponse`)
  - `GET /api/tarot/interpretations` (`@AuthPrincipal` 필수) → 이력 목록(최신순)

`db/migrations/0009_create_tarot_interpretations.sql`로 새 테이블을 추가한다.

API 키는 Render/로컬 모두 `ANTHROPIC_API_KEY` 환경변수로 관리한다 (기존 `KAKAO_CLIENT_ID` 등과 동일 패턴). `application-local.properties.example`에 항목을 추가한다.

### 프론트엔드

- **`lib/tarotInterpretation.ts`** (신규): `requestInterpretation(payload, token)`, `getInterpretationHistory(token)`
- **`/tarot` 페이지**:
  - 모드 선택 화면 3버튼 + 각 버튼에 남은 횟수 표시 (`progress.tarotUsage`, `progress.generateUsage` 활용)
  - 타로만 보기 / 별자리 모드: 카드 공개 후 기존 "번호 뽑기" 버튼 자리를 "종합 해석 보기" 버튼으로 교체. 클릭 시 로딩 상태 표시 → 성공하면 해석 문단 표시, 실패하면 에러 메시지 + "다시 시도" 버튼(카드 상태 유지한 채 재요청 가능)
  - 번호 뽑기용 타로 모드: 기존 별자리 모드의 카드 뽑기 UI(드래그로 카드 공개, 카드 이미지/이름/키워드 표시)를 재사용하되, 이 모드는 "해석 없음"이 원칙이므로 카드별 `fortunes` 한 줄 문구와 별자리 설명 문구는 표시하지 않는다 — 카드 공개 연출과 이름/키워드만 보여주고 바로 번호 결과로 이어진다. 세트 수 조절 UI(`progress.adjustableSets`일 때 +/- 버튼, `/generate` 페이지와 동일 패턴)는 카드 공개 직후 "번호 뽑기" 버튼과 함께 노출한다
- **`/mypage` 페이지**: "타로 해석 기록" 섹션 신규 추가 — 저장된 번호 섹션과 별개로, 날짜순 목록에 모드/카드/해석문 표시 (월별/주별 그룹핑 없이 단순 리스트 — 하루 최대 1건이라 그룹핑 인프라가 필요할 정도로 쌓이지 않음)

## 에러 처리

- AI 호출 실패(네트워크/레이트리밋/타임아웃) → 횟수 원복 후 502, 프론트는 "해석을 가져오지 못했어요. 다시 시도해주세요." + 재시도 버튼
- 횟수 소진 상태에서 해석/번호 뽑기 버튼을 눌렀지만 그 사이 다른 탭에서 소진된 경우 → 기존과 동일하게 429 → "오늘 횟수를 다 쓰셨어요" 메시지
- `/mypage` 해석 이력 조회 실패 → 안내 문구 표시 (저장된 번호 섹션은 정상 동작)

## 테스트

- **백엔드**: `TarotInterpretationServiceTest` — 횟수 소진 시 AI 호출 안 함, AI 호출 성공 시 저장+반환, AI 호출 실패 시 횟수 원복(Mockito로 `ClaudeTarotInterpreter` 목 처리). `ProgressController`에 추가되는 `generate-usage` 엔드포인트 테스트(기존 `tarot-usage` 테스트와 동일 패턴)
- **프론트**: `lib/tarotInterpretation.ts` 유닛 테스트(성공/429/502 응답 처리). 여러 세트 뽑기 헬퍼(가중치 분포에서 N세트 독립 샘플링) 유닛 테스트. `/tarot`, `/mypage`는 타입체크 + 브라우저 수동 확인(모드별 남은 횟수 표시, AI 해석 성공/실패 흐름, 번호용 타로 세트 조절, 마이페이지 이력 표시)
