# 연금복권720+ 프론트 뽑기 화면 (3단계) 설계

## 배경 및 목적

2단계에서 연금복권720+ 번호를 완전 랜덤으로 생성하는 백엔드(`GET /api/pension/generate`)와 등급 무관 하루 1회 진행도 연동을 만들었다. 이번 3단계는 실제로 사용자가 이 기능을 쓸 수 있는 프론트엔드 화면을 추가한다.

## 범위

**포함:**
- 새 페이지 `/pension` — 로그인 게이트, 뽑기 버튼, 슬롯머신 스타일 연출, 결과 카드
- 슬롯머신 스타일 연출 컴포넌트 (조 1자리 + 6자리 번호, 총 7개 릴)
- 등급 무관 하루 1회 제한에 맞춘 소진 상태 UI ("내일 다시 시도해주세요")
- 네비게이션/사이트맵에 새 페이지 반영
- `lib/api.ts`/`lib/progress.ts`에 필요한 타입/함수 추가

**제외 (다음 단계로 미룸):**
- 뽑은 번호 저장(마이페이지 연동), 실제 당첨 매칭 — 4단계

## 설계 결정

**왜 새 페이지인가:** 연금복권 결과 형태(조 1~5 + 6자리 번호)가 로또(6개 공)와 완전히 달라서, 기존 `/generate`에 세 번째 모드로 끼워 넣으면 결과 카드 렌더링을 위한 조건 분기가 지저분해진다. 독립된 페이지로 만들어 `/generate`/`/tarot`와 나란히 두는 게 더 단순하다 (사용자 결정 사항).

**왜 물리 시뮬레이션이 아니라 슬롯머신 릴인가:** 기존 `LottoDrawAnimation`은 45개 공이 캔버스 안에서 물리적으로 굴러다니다 뽑히는 연출인데, 이건 "45개 중 6개를 뽑는" 로또 구조에 맞춘 것이다. 연금복권은 조 1개 + 6자리 숫자 1개를 그 자리에서 결정하는 구조라 "공 뽑기" 은유가 안 맞는다. 대신 각 자리(조 1개 + 숫자 6자리 = 릴 7개)가 슬롯머신처럼 숫자를 순환하다 순서대로 멈추는 연출을 쓴다. 실제 복권 자릿수 표시와도 자연스럽게 어울리고, 캔버스+물리 연산 없이 CSS 트랜지션만으로 구현 가능해 훨씬 가볍다 (사용자 결정 사항).

## 아키텍처

### `PensionDrawAnimation` 컴포넌트 (신규)

```
interface PensionDrawAnimationProps {
  groupNo: number;   // 1~5
  number: string;    // 6자리, 예: "011391"
  onComplete: () => void;
}
```

7개의 릴을 나란히 배치한다: 첫 번째는 조(1~5 숫자를 순환), 나머지 6개는 각각 `number`의 한 자리씩(0~9를 순환). 각 릴은 CSS로 세로로 쌓인 숫자 스트립을 계속 순환시키다가, 정해진 시점에 목표 숫자 위치로 멈춘다. 조 릴이 먼저 멈추고, 그다음 왼쪽 자리부터 순서대로 하나씩 멈춘다(각 릴 사이에 짧은 시차) — 기존 `LottoDrawAnimation`의 "하나씩 순서대로 뽑히는" 리듬과 같은 느낌을 CSS만으로 재현한다. 기존 로또 애니메이션처럼 탭하면 바로 결과를 보여주고 건너뛸 수 있다. 마지막 릴이 멈춘 뒤 짧은 정지 시간을 두고 `onComplete()`를 호출한다.

### `/pension` 페이지 (신규)

`/generate`와 같은 구조: 히어로 섹션, 로그인 안 됨 시 안내+카카오 로그인 버튼, 로그인 시 카드 안에 뽑기 버튼/애니메이션/결과.

State:
- `loading`: API 호출 진행 중
- `error`: 에러 메시지 (429 포함)
- `pendingResult`: API가 반환한 결과, 애니메이션 재생 중에는 아직 화면에 확정 표시하지 않음
- `pensionResult`: 애니메이션이 끝나 확정된 결과 (조/번호를 카드로 표시)
- `animating`: 애니메이션 재생 중 여부

버튼 활성/문구는 `progress.pensionUsage`(2단계에서 추가된 필드)를 기준으로 판단한다: `used >= limit`이면 버튼 비활성화 + "내일 다시 시도해주세요" (타로 모드 선택 화면의 소진 문구와 동일한 패턴), 아니면 "연금복권 번호 뽑기" 버튼을 활성 상태로 보여준다.

### 데이터 흐름

```
"연금복권 번호 뽑기" 버튼 클릭
  → generatePension(token) 호출 (GET /api/pension/generate)
      → 429: "오늘 이미 사용하셨어요. 내일 다시 도전해주세요." 에러 표시, 종료
      → 성공: refreshProgress() 호출(진행도 갱신), pendingResult에 결과 저장, animating = true
  → <PensionDrawAnimation groupNo={pendingResult.groupNo} number={pendingResult.number} onComplete={...} /> 렌더
  → 애니메이션 완료(또는 탭으로 건너뜀) → onComplete
      → pensionResult = pendingResult, pendingResult = null, animating = false
  → 결과 카드: "N조 XXXXXX" 형태로 표시
```

### 그 외 파일 변경

- `frontend/lib/api.ts`: `generatePension(token: string): Promise<{ groupNo: number; number: string }>` 추가 — 기존 `triggerCrawl` 등과 같은 fetch 패턴, 429는 별도 에러 메시지로 매핑
- `frontend/lib/progress.ts`: `ProgressResult`에 `pensionUsage: { used: number; limit: number }` 필드 추가 (백엔드 `ProgressResponse`가 이미 이 필드를 내려주고 있음 — 프론트 타입만 뒤늦게 따라잡는 것)
- `frontend/app/components/Nav.tsx`: `LINKS` 배열에 `{ href: "/pension", label: "연금복권" }` 추가
- `frontend/app/sitemap.ts`: `ROUTES`에 `/pension` 추가 (`/generate`와 동일하게 로그인 필요해도 페이지 자체는 공개 크롤링 대상)

## 에러 처리

- 로그인 안 됨: 기존 페이지들과 동일한 패턴(안내 문구 + 카카오 로그인 버튼)
- 429(오늘 이미 사용): "오늘 이미 사용하셨어요. 내일 다시 도전해주세요." 표시
- 그 외 실패(네트워크 등): "번호 생성에 실패했습니다." 같은 일반 에러 메시지 (기존 `/generate` 패턴과 동일)

## 테스트

- `PensionDrawAnimation`/`/pension` 페이지: 이 코드베이스 컨벤션상 전용 테스트 없음 (기존 `LottoDrawAnimation`도 동일) — 타입체크(`tsc --noEmit`) + 브라우저 수동 확인(로그인 게이트, 뽑기 버튼, 애니메이션 재생/탭으로 건너뛰기, 결과 카드, 소진 상태 문구)으로 검증

## 영향받는 파일

- `frontend/app/pension/page.tsx` — 신규
- `frontend/app/pension/page.module.css` — 신규
- `frontend/app/components/PensionDrawAnimation.tsx` — 신규
- `frontend/app/components/PensionDrawAnimation.module.css` — 신규
- `frontend/lib/api.ts` — `generatePension` 추가
- `frontend/lib/progress.ts` — `ProgressResult.pensionUsage` 추가
- `frontend/app/components/Nav.tsx` — "연금복권" 링크 추가
- `frontend/app/sitemap.ts` — `/pension` 라우트 추가

## 배포 참고사항

없음 — 프론트엔드 전용 정적 변경, 백엔드는 2단계에서 이미 배포됨.
