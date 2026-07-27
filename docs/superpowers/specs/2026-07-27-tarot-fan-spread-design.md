# 타로 카드 부채꼴 스프레드 UI 설계

## 배경 및 목적

`/tarot`는 78장 전체를 하나의 그리드(`.spread`)에 카드 뒷면 버튼으로 늘어놓고, 그중 아무 카드나 눌러 선택하는 방식이다. 78장을 한 화면에 전부 펼치면 시각적으로 답답하고, 셔플 애니메이션도 없어 밋밋하다. 실제 타로처럼 78장 중 일부(20장)만 부채꼴로 펼쳐 보여주고, "다시 섞기"를 누르면 다른 20장이 다시 셔플-딜링 애니메이션과 함께 나타나도록 개선한다.

## 범위

**포함:**
- 카드 한 장을 뽑는 모드(별자리 함께보기 / 번호 뽑기용 타로)와 세 장을 순서대로 뽑는 모드(타로만 보기) 모두에 동일하게 적용
- 78장 중 무작위 20장을 부채꼴(호 모양, 겹침)로 배치
- 진입 시 / "다시 섞기" 클릭 시: 카드들이 가운데 한 점에 모여 있다가 각자의 부채 자리로 순서대로 펼쳐지는 딜링 애니메이션
- "다시 섞기" 버튼: 78장(3장 모드에서는 이미 뽑은 카드 제외) 중에서 완전히 새로운 20장을 다시 뽑음
- 3장 모드에서 카드를 한 장 고르면 그 카드만 부채에서 빠지고, 나머지는 그대로 있되 부채 모양만 다시 계산해 자리를 채움
- 좁은 화면(모바일)에서 부채가 컨테이너 폭을 넘지 않도록 반지름/각도를 자동으로 축소

**제외:**
- 실제 카드가 뒤섞이는 정교한 물리 기반 셔플 애니메이션(리플/오버핸드 셔플 시뮬레이션) — CSS 트랜지션만으로 구현 가능한 "모였다가 부채로 펼쳐지는" 딜링 동작으로 "섞는 느낌"을 대신한다
- 카드 뒤집기(방향 선택) 이후 단계의 UI/로직 — 변경 없음
- 백엔드/DB — 이번 변경은 프론트엔드 전용

## 아키텍처

### 컴포넌트 분리

현재 `page.tsx`의 `.spread` 그리드 렌더링 블록(두 곳: 단일 카드 모드용, 3장 모드용)을 새 컴포넌트 `frontend/app/tarot/TarotFanSpread.tsx`로 대체한다.

```ts
interface TarotFanSpreadProps {
  cards: TarotCard[];       // 현재 부채에 보이는 카드들 (최대 20장)
  onPick: (card: TarotCard) => void;
  dealKey: number;          // 값이 바뀔 때마다 "모였다가 펼쳐지는" 딜링 애니메이션을 재생
}
```

- `dealKey`가 바뀌면: 모든 카드가 가운데 한 점(collapsed 상태: 중앙 하단, 축소, 투명)에서 각자의 부채 자리(fanned 상태)로 순서대로(인덱스별 약간의 지연) 이동하는 애니메이션을 재생한다.
- `dealKey`가 안 바뀐 채 `cards` 배열만 줄어들면(카드 한 장을 골라서 제거된 경우): 딜링 애니메이션 없이, 남은 카드들이 새로 계산된 부채 위치로 CSS 트랜지션만으로 자연스럽게 이동한다.
- React key는 `card.number`를 사용해 DOM 노드를 재사용하고, 배열이 줄어들 때 남은 카드 엘리먼트가 그대로 유지되며 위치만 바뀌게 한다 (전체 리마운트 방지).

### 부채꼴 위치 계산 (순수 함수)

`frontend/lib/fanLayout.ts`에 새 순수 함수를 추가한다:

```ts
export function computeFanTransform(index: number, total: number, containerWidth: number): {
  x: number; y: number; rotate: number;
}
```

- `total`장을 좌우 대칭 호 모양으로 배치: 인덱스 0은 맨 왼쪽, 마지막 인덱스는 맨 오른쪽, 가운데 인덱스가 정점.
- `total === 1`일 때(3장 모드에서 마지막 한 장만 남는 경우) 0으로 나누는 문제를 피하기 위해 각도를 0(정중앙)으로 특수 처리한다.
- 부채의 최대 각도/반지름은 `containerWidth`에 비례해서 정해지며, 좁은 화면일수록 각도/반지름이 줄어들어 카드가 컨테이너 밖으로 삐져나가지 않는다 (하한선 존재).
- `TarotFanSpread`는 `ResizeObserver` 또는 `useLayoutEffect` + `window.resize` 리스너로 컨테이너 폭을 측정해 이 함수에 전달한다.

### 20장 뽑기 / 다시 섞기 로직

`frontend/lib/tarotCards.ts`에 `shuffleCards` 옆에 새 함수를 추가한다:

```ts
export const FAN_SIZE = 20;

export function buildFanDeck(pool: TarotCard[], exclude: Set<number>, count: number = FAN_SIZE): TarotCard[] {
  const remaining = pool.filter((c) => !exclude.has(c.number));
  return shuffleCards(remaining).slice(0, count);
}
```

- `page.tsx`는 뽑기 화면에 처음 진입할 때(모드를 고른 직후) 딱 한 번만 `fanDeck` state를 `buildFanDeck(TAROT_CARDS, exclude)`로 초기화한다. 3장 모드에서 포지션 1 → 2 → 3으로 넘어갈 때는 이 초기화가 다시 일어나지 않는다 — 카드를 고르면 그 카드만 `fanDeck`에서 빠지고 나머지 19장(그다음은 18장)이 이어서 다음 포지션의 부채로 쓰인다.
  - 단일 카드 모드: `exclude`는 빈 Set (아직 아무것도 안 뽑았으므로).
  - 3장 모드: 최초 초기화 시점에는 아직 아무것도 안 뽑았으므로 `exclude`도 빈 Set — 이후 "다시 섞기"를 누를 때만 `spreadSlots.map(s => s.card.number)`의 Set을 `exclude`로 사용해 이미 뽑은 카드가 다시 나타나지 않게 한다.
- "다시 섞기" 버튼 클릭 시: 같은 `buildFanDeck` 호출로 `fanDeck`을 새로 교체하고, `dealKey`를 1 증가시켜 딜링 애니메이션을 재생한다.
- 카드를 한 장 고르면(기존 `handleCardClick`): `fanDeck`에서 그 카드만 제거한다 (`dealKey`는 그대로 — 딜링 애니메이션 없이 자연스럽게 재배치).

### "다시 섞기" 버튼 위치

기존 안내 문구("카드 한 장을 골라주세요" / "'{포지션}' 카드를 골라주세요 (n/3)") 옆에 배치하고, 현재 포지션의 카드를 아직 고르지 않은 동안 항상 눌러서 쓸 수 있다 (3장 모드에서 포지션 2, 3을 고를 때도 사용 가능).

## 데이터 흐름 요약

```
모드 선택 직후 (최초 1회만)
  → fanDeck = buildFanDeck(TAROT_CARDS, exclude: 빈 Set)
  → dealKey += 1  (딜링 애니메이션 재생)

"다시 섞기" 클릭 (아직 현재 포지션 카드를 고르기 전이면 언제든 가능)
  → exclude = 3장 모드면 spreadSlots에 이미 담긴 카드 번호들, 단일 모드면 빈 Set
  → fanDeck = buildFanDeck(TAROT_CARDS, exclude)
  → dealKey += 1  (딜링 애니메이션 재생)

카드 클릭 (onPick)
  → fanDeck에서 해당 카드만 제거 (dealKey 변경 없음 → 딜링 없이 자연스러운 재배치만)
  → (기존 로직) 단일 모드: 드래그-공개 단계로 진입 / 3장 모드: spreadSlots에 추가 후 다음 포지션도 같은 fanDeck을 이어서 사용
```

## 에러 처리

새로운 실패 시나리오는 없다 — 전부 클라이언트 메모리 상의 배열 연산이며 네트워크/DB 호출이 없다.

## 테스트

- `fanLayout.test.ts`: `computeFanTransform`이 몇 개의 대표 인덱스/전체장수 조합에서 기대한 각도/좌표 부호(왼쪽은 음수 x, 오른쪽은 양수 x 등)를 반환하는지, `total === 1`일 때 각도가 0인지 확인.
- `tarotCards.test.ts`에 `buildFanDeck` 테스트 추가: 반환 개수가 `count`(또는 pool이 더 작으면 pool 크기)와 같은지, `exclude`에 담긴 카드 번호가 결과에 없는지, 매 호출마다 순서가 달라질 수 있는지(완전 결정론적이지 않음을 확인하는 대신 "exclude 준수 + 개수 정확성"만 검증).
- 애니메이션/시각적 레이아웃 자체는 자동 테스트 대상이 아니다 (기존 드래그 인터랙션과 동일한 원칙) — 브라우저에서 수동으로 딜링 애니메이션, 반응형 축소, "다시 섞기" 동작을 확인한다.

## 영향받는 파일

- `frontend/app/tarot/TarotFanSpread.tsx` — 신규, 부채꼴 렌더링 + 딜링 애니메이션 컴포넌트
- `frontend/app/tarot/page.tsx` — 기존 `.spread` 그리드 렌더링 두 곳을 `TarotFanSpread` 사용으로 교체, `fanDeck`/`dealKey` state와 "다시 섞기" 버튼 추가
- `frontend/app/tarot/page.module.css` — 기존 `.spread`/`.cardBack` 관련 스타일 정리, `TarotFanSpread` 전용 스타일 추가 (또는 `TarotFanSpread.module.css` 신규)
- `frontend/lib/fanLayout.ts` — 신규, `computeFanTransform` 순수 함수
- `frontend/lib/fanLayout.test.ts` — 신규
- `frontend/lib/tarotCards.ts` — `buildFanDeck`, `FAN_SIZE` 추가 (`shuffleCards`는 그대로 유지, 내부에서 재사용)
- `frontend/lib/tarotCards.test.ts` — `buildFanDeck` 테스트 추가
