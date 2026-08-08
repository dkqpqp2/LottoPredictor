# /generate 페이지 번호 분석 섹션(출현 빈도 + 구간 분포) 설계

## 배경 및 목적

`/generate` 페이지를 "AI가 번호를 뽑아주는 화면"보다 "데이터를 분석해서 보여주는 화면"에 가깝게 만들기 위해, 이미 존재하는 통계 데이터를 활용한 시각화 섹션을 추가한다. 사용자가 추천 번호를 그냥 받는 게 아니라, 그 근거가 되는 데이터(출현 빈도, 번호 구간 분포)를 직접 볼 수 있게 한다.

## 범위

**포함:**
- `/generate` 페이지에 "N회 번호 분석" 섹션 신규 추가 — 출현 빈도 상위 랭킹 + 번호 구간별 분포, 두 개의 막대그래프
- `/stats` 페이지에만 있던 "구간별로 묶기" 로직을 공용 함수로 분리해서 두 페이지가 같이 씀

**제외:**
- 백엔드 변경 — 기존 `GET /api/stats` 그대로 사용, 새 엔드포인트나 "최근 N회차만" 집계 없음
- 차트 라이브러리 도입 — `/stats` 페이지가 이미 쓰고 있는 CSS 퍼센트 너비 막대 방식 그대로 재사용
- `/stats` 페이지 자체의 변경 (구간 분포 표시는 그대로 두고, 계산 로직만 공용 함수로 옮김 — 겉보기 동작은 동일해야 함)

## 설계 결정

**왜 백엔드를 안 건드리는가:** 이미 있는 `GET /api/stats`(`NumberStat[]`, 역대 전체 회차 기준 출현 빈도)를 그대로 재사용한다. "최근 N회차만" 집계는 이 사이트가 아직 안 가진 기능이라 새로 만들어야 하는데, 지금 목표는 "새 통계 기능을 만드는 것"이 아니라 "이미 계산해둔 데이터를 다른 화면에서도 근거로 보여주는 것"이라 범위 밖으로 뺀다 (사용자 결정 사항).

**왜 구간 묶기 로직을 공용 함수로 빼는가:** `/stats/page.tsx`의 기존 `rangeGroups`(현재 컴포넌트 내부 `useMemo`)는 `NumberStat[]`을 01–10/11–20/21–30/31–40/41–45 다섯 구간으로 나눠, 각 구간에 속한 `NumberStat` 항목들을 그대로 묶는 순수 함수다(구간별 합계가 아니라 "이 구간에 속한 번호들의 목록"을 반환 — `/stats`는 이 목록을 그대로 순회해서 번호 하나하나의 막대를 그린다). `/generate` 페이지도 정확히 같은 입력(`NumberStat[]`)에 정확히 같은 "다섯 구간으로 나누기" 계산이 필요하므로, 이건 "구조가 비슷한 두 페이지"가 아니라 "완전히 같은 로직을 두 곳에서 쓰는 것"이다. `/generate`는 이 묶음을 그대로 쓰지 않고 구간별 합계 하나로 더 압축해서 보여주지만, "다섯 구간으로 나누는" 부분 자체는 동일하므로 그 부분만 공유한다. 이 프로젝트는 보통 페이지 단위 컴포넌트/CSS는 중복을 허용하는 편이지만(공통 베이스를 두지 않는 게 기존 컨벤션), 이번 건 순수 계산 로직 자체가 동일해서 공유가 더 맞다고 판단했다.

**왜 차트 라이브러리를 안 쓰는가:** 프론트엔드에 차트 라이브러리가 전혀 없고(`recharts`/`chart.js`/`d3` 등 미설치), `/stats` 페이지가 이미 "트랙 안에 퍼센트 너비 막대"라는 순수 CSS 방식으로 막대그래프를 구현해 잘 동작하고 있다. 새 의존성을 추가하는 대신 같은 패턴을 재사용해서 시각적 일관성도 지키고 번들 크기도 늘리지 않는다.

## 아키텍처

### `frontend/lib/numberRangeGroups.ts` (신규)

```ts
import type { NumberStat } from "./api";

export interface NumberRangeGroup {
  label: string;          // "1-10", "11-20", ...
  items: NumberStat[];    // 이 구간에 속한 번호들의 통계 (번호순 정렬)
}

export function groupByRange(stats: NumberStat[]): NumberRangeGroup[] {
  const byNumber = [...stats].sort((a, b) => a.number - b.number);
  const groups: NumberRangeGroup[] = [];
  for (let start = 1; start <= 41; start += 10) {
    const end = Math.min(start + 9, 45);
    groups.push({
      label: `${start}-${end}`,
      items: byNumber.filter((s) => s.number >= start && s.number <= end),
    });
  }
  return groups;
}
```

이 함수는 `/stats/page.tsx`의 기존 `rangeGroups` useMemo 계산(현재 컴포넌트 내부에 인라인으로 있고, 정확히 이 로직을 그대로 담고 있음)을 그대로 옮긴 것이다 — `/stats`는 `groupByRange(stats)`를 호출하는 형태로 교체하고, 결과 값과 화면 표시는 100% 동일하게 유지된다.

`/generate`는 이 함수가 반환하는 `items`를 그대로 나열하지 않고, 각 구간의 합계 하나로 더 압축해서 보여준다 — `group.items.reduce((sum, s) => sum + s.count, 0)`로 구간별 합계를 페이지 자체에서 계산한다(이 합산 자체는 `/stats`에 없는 계산이라 공용 함수에 넣지 않고 `/generate` 쪽에 둔다).

### `/generate` 페이지 (수정)

기존 데이터 fetch(`getDraws`, `getWeeklyPick`, `getWeeklyPickHistory`)와 같은 `useEffect`에 `getStats()` 추가:

```ts
const [stats, setStats] = useState<NumberStat[] | null>(null);
...
getStats().then(setStats).catch(() => setStats(null));
```

새 섹션은 `weeklyCard`와 `historyCard` 사이에 삽입한다. 제목은 이미 fetch되어 있는 `weeklyPick.targetDrawNo`를 재사용해서 "{N}회 번호 분석"으로 표시하므로, `weeklyPick`이 로드된 이후에만 이 섹션이 보인다 (`stats && weeklyPick` 둘 다 있을 때).

내용 구성:
- **출현 빈도 랭킹**: `stats`를 `count` 내림차순 정렬 후 상위 8개. 각 항목은 번호(공 색상은 기존 `getBallColor()` 재사용) + 가로 막대(퍼센트 너비, 상위 8개 중 최댓값 기준 정규화) + 출현 횟수 텍스트.
- **번호 구간 분포**: `groupByRange(stats)` 결과 5개 구간 각각에 대해 `items.reduce((sum, s) => sum + s.count, 0)`로 구간 합계를 구해 가로 막대로 표시 (구간 합계 중 최댓값 기준 정규화 — `/stats`가 쓰는 개별 번호 percentage 기준 정규화와는 다른 스케일), 구간 라벨 + 막대 + 합계 텍스트.

두 하위 목록 모두 `/stats` 페이지의 기존 막대 마크업(트랙 `<span>` + 퍼센트 너비 내부 `<span>`) 구조를 그대로 재사용한다.

### 실패 처리

`getStats()`가 실패하면 `stats`는 `null`로 남고, 분석 섹션 전체가 렌더링되지 않는다 (기존 `latestCard`/`weeklyCard`/`historyCard`와 동일한 "조용히 숨기기" 패턴, 별도 에러 메시지 없음).

## 데이터 흐름

```
/generate 페이지 진입
  → GET /api/draws?page=0&size=1     → 최근 당첨번호 카드
  → GET /api/weekly-pick             → 이번주 추천 카드
  → GET /api/weekly-pick/history     → 지난 이력 카드
  → GET /api/stats (신규 fetch, 기존 엔드포인트)
      → 출현 빈도 상위 8개 랭킹 계산 (정렬만, 새 로직 없음)
      → groupByRange()로 5구간 분포 계산 (공용 함수, 신규)
  → "{weeklyPick.targetDrawNo}회 번호 분석" 섹션 렌더링
```

## 테스트

- `frontend/lib/numberRangeGroups.test.ts` (신규): `groupByRange()`가 5개 구간을 올바르게 나누는지, 구간 경계값(10/11, 40/41 등)이 정확한지, 각 구간의 `items`가 번호순으로 정렬되어 있는지, 빈 배열 입력 시 5개 구간 모두 `items: []`로 나오는지 검증
- `/stats` 페이지가 `groupByRange()`로 바뀐 뒤에도 기존 화면 표시가 동일한지는 수동 확인(전용 테스트 없음, 기존 컨벤션과 동일 — `/stats` 페이지 자체는 원래도 전용 테스트가 없었음)
- `/generate` 페이지의 새 섹션은 이 코드베이스 컨벤션상 전용 테스트 없음 — 타입체크 + 브라우저 확인

## 영향받는 파일

- `frontend/lib/numberRangeGroups.ts` — 신규
- `frontend/lib/numberRangeGroups.test.ts` — 신규
- `frontend/app/stats/page.tsx` — 수정 (인라인 `rangeGroups` 계산을 `groupByRange()` 호출로 교체)
- `frontend/app/generate/page.tsx` — 수정 (분석 섹션 추가)
- `frontend/app/generate/generate.module.css` — 수정 (분석 섹션 관련 클래스 추가, `/stats`의 막대 클래스 참고)

## 배포 참고사항

없음 — 프론트엔드 전용 변경, 백엔드/DB 마이그레이션 없음.
