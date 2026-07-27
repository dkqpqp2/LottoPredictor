# 타로 카드 78장 확장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/tarot`의 카드 덱을 메이저 아르카나 22장에서 정식 78장(메이저 22 + 마이너 56)으로 확장한다.

**Architecture:** `TAROT_CARDS` 배열에 마이너 아르카나 56장(지팡이/성배/검/오망성 각 14장)을 22~77번으로 이어 붙이고, 번호 뽑기용 타로 모드의 카드→로또 시드값 매핑 공식을 78장 기준으로 일반화한다. 카드 이미지는 기존 22장과 동일하게 Wikimedia Commons의 퍼블릭도메인 라이더-웨이트 덱에서 내려받는다.

**Tech Stack:** Next.js 16 / TypeScript / Vitest

## Global Constraints

- 메이저 아르카나 0~21번은 번호를 바꾸지 않는다.
- 마이너 아르카나 56장은 22~77번을 순서대로 부여한다: 지팡이(22~35) → 성배(36~49) → 검(50~63) → 오망성(64~77), 각 수트 안에서는 에이스~10 → 시종 → 기사 → 여왕 → 왕 순서.
- `cardSeedNumber(card) = (card.number % 45) + 1`로 일반화한다 — 기존 22장의 시드값이 전부 1씩 밀리는 것은 설계상 의도된 트레이드오프다 (스펙 문서 참고).
- 카드 이미지는 `frontend/public/tarot/{number}.jpg`에 저장하며, 출처는 Wikimedia Commons `Special:FilePath/{파일명}` 리다이렉트 경로다 (해시 경로를 몰라도 파일명만으로 다운로드 가능).
- 새 카드 56장 전부 `TarotCard` 인터페이스(`number, nameEn, nameKo, keyword, fortunes: {up, down, left, right}`)를 그대로 따른다 — 인터페이스 변경 없음.
- 톤: 기존 22장과 동일하게 따뜻하고 격려하는 2인칭 한 문장, 점술적 단정 대신 가벼운 참고용 조언.

---

### Task 1: `cardSeedNumber` 시드값 매핑 일반화

**Files:**
- Modify: `frontend/lib/tarotNumberGenerator.ts:10-12`
- Test: `frontend/lib/tarotNumberGenerator.test.ts`

**Interfaces:**
- Consumes: 없음 (기존 `TarotCard` 타입만 사용)
- Produces: `cardSeedNumber(card: TarotCard): number` — 기존과 동일한 함수 시그니처, 반환값 공식만 변경. `buildWeights`/`addCardWeight`는 내부에서 이 함수를 그대로 호출하므로 수정 불필요.

이 태스크는 카드 데이터(Task 3)와 독립적이다 — `cardSeedNumber`는 `card.number`만 보고 계산하므로 마이너 아르카나 카드가 아직 추가되지 않았어도 테스트 가능하다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/lib/tarotNumberGenerator.test.ts`에서 `cardSeedNumber` 관련 부분을 찾아 다음으로 교체 (기존에 `cardSeedNumber`를 직접 테스트하는 `describe` 블록이 있다 — 그 블록 전체를 아래로 교체):

```ts
describe("cardSeedNumber", () => {
  it("maps card number 0 to seed 1", () => {
    expect(cardSeedNumber(fool)).toBe(1);
  });

  it("maps a mid-range major arcana card number to number + 1", () => {
    expect(cardSeedNumber(star)).toBe(18);
  });

  it("maps major arcana card number 21 to seed 22", () => {
    const world = { ...star, number: 21 };
    expect(cardSeedNumber(world)).toBe(22);
  });

  it("wraps minor arcana card numbers back into the 1-45 range via modulo", () => {
    const aceOfWands = { ...star, number: 22 };
    expect(cardSeedNumber(aceOfWands)).toBe(23);

    const kingOfPentacles = { ...star, number: 77 };
    expect(cardSeedNumber(kingOfPentacles)).toBe(33);
  });
});
```

(`star`와 `fool`은 파일 상단에 이미 `TAROT_CARDS.find(...)`로 정의되어 있다 — 그대로 재사용한다. `{ ...star, number: N }`으로 임시 카드 객체를 만들어 순수하게 번호만 테스트한다.)

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd frontend && npx vitest run lib/tarotNumberGenerator.test.ts`
Expected: FAIL (`maps card number 0 to seed 1` 등이 기존 구현의 `22` 대신 `1`을 기대하므로 실패)

- [ ] **Step 3: `cardSeedNumber` 구현 변경**

`frontend/lib/tarotNumberGenerator.ts`에서:

```ts
export function cardSeedNumber(card: TarotCard): number {
  return card.number === 0 ? 22 : card.number;
}
```

를 다음으로 교체:

```ts
export function cardSeedNumber(card: TarotCard): number {
  return (card.number % 45) + 1;
}
```

- [ ] **Step 4: 테스트 실행해서 `buildWeights` 쪽 실패 확인**

Run: `cd frontend && npx vitest run lib/tarotNumberGenerator.test.ts`
Expected: `cardSeedNumber` describe 블록은 통과, 하지만 `buildWeights` describe 블록 안의 다음 두 테스트가 실패한다 (둘 다 `star`의 예전 시드값 17을 하드코딩하고 있는데, `star`의 새 시드값은 18이라서):
- `"boosts the card's seed number and its +22 pair"`
- `"still boosts the card's seed number when no zodiac is given"`

- [ ] **Step 5: 실패하는 두 테스트를 새 시드값에 맞게 수정**

`frontend/lib/tarotNumberGenerator.test.ts`에서 다음 부분:

```ts
  it("boosts the card's seed number and its +22 pair", () => {
    const weights = buildWeights(star, aries, "down");
    expect(weights[17]).toBeGreaterThanOrEqual(1 + 8);
    expect(weights[39]).toBeGreaterThanOrEqual(1 + 8);
  });
```

를 다음으로 교체 (`star`의 새 시드값 18과 그 짝 40):

```ts
  it("boosts the card's seed number and its +22 pair", () => {
    const weights = buildWeights(star, aries, "down");
    expect(weights[18]).toBeGreaterThanOrEqual(1 + 8);
    expect(weights[40]).toBeGreaterThanOrEqual(1 + 8);
  });
```

그리고:

```ts
  it("still boosts the card's seed number when no zodiac is given", () => {
    const weights = buildWeights(star, null, "down");
    expect(weights[17]).toBeGreaterThanOrEqual(1 + 8);
    expect(weights[39]).toBeGreaterThanOrEqual(1 + 8);
  });
```

를 다음으로 교체:

```ts
  it("still boosts the card's seed number when no zodiac is given", () => {
    const weights = buildWeights(star, null, "down");
    expect(weights[18]).toBeGreaterThanOrEqual(1 + 8);
    expect(weights[40]).toBeGreaterThanOrEqual(1 + 8);
  });
```

마지막으로, `"left"`/`"right"` 방향 테스트 두 곳에 있는 `// seed = 17` 주석을 `// seed = 18`로 고친다 (주석만 갱신 — 두 테스트의 실제 비교값 `weights[20]`/`weights[40]`은 새 시드값 18 기준으로도 결과가 동일해서 그대로 둬도 되지만, 주석이 틀린 값을 가리키면 안 되므로 갱신한다):

```ts
  it("boosts numbers near the card's seed for the 'left' direction", () => {
    const weights = buildWeights(star, aries, "left"); // seed = 18
    expect(weights[20]).toBeGreaterThan(weights[40]);
  });

  it("boosts numbers far from the card's seed for the 'right' direction", () => {
    const weights = buildWeights(star, aries, "right"); // seed = 18
    expect(weights[40]).toBeGreaterThan(weights[20]);
  });
```

(`"boosts the zodiac's lucky numbers"` 테스트는 `weights[18]`을 확인하는데, 공교롭게 `star`의 새 시드값도 18이 되어 카드 가중치와 별자리 가중치가 같은 칸에 겹친다. `toBeGreaterThanOrEqual(1 + 5)` 조건은 실제값이 더 커져도 여전히 참이라 테스트는 그대로 통과한다 — 수정 불필요.)

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd frontend && npx vitest run lib/tarotNumberGenerator.test.ts`
Expected: 전부 통과

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/tarotNumberGenerator.ts frontend/lib/tarotNumberGenerator.test.ts
git commit -m "Generalize card seed number mapping for a full 78-card deck"
```

---

### Task 2: 마이너 아르카나 카드 이미지 56장 다운로드

**Files:**
- Create: `frontend/public/tarot/22.jpg` ~ `frontend/public/tarot/77.jpg` (56개 파일)

**Interfaces:**
- Consumes: 없음
- Produces: 22~77번 이미지 파일 — Task 3에서 `<Image src={`/tarot/${card.number}.jpg`} .../>`가 그대로 이 파일들을 참조한다 (기존 페이지 코드는 이미 `card.number`로 경로를 구성하므로 코드 변경 없음).

이미지는 Wikimedia Commons의 `Special:FilePath/{파일명}` 경로로 받는다 — 이 경로는 실제 파일의 해시 디렉터리를 몰라도 파일명만으로 302/301 리다이렉트를 따라가 원본 이미지를 받아올 수 있다 (사전 확인 완료, 전부 퍼블릭도메인 1909년 라이더-웨이트 덱).

**주의:** Wikimedia는 짧은 시간에 여러 요청을 보내면 429(Too Many Requests)를 반환할 수 있다. 아래 스크립트는 요청 사이에 지연을 두고, 실패하면 최대 5회까지 재시도한다.

- [ ] **Step 1: 다운로드 스크립트 실행**

```bash
mkdir -p frontend/public/tarot

download() {
  local num="$1" name="$2" attempt=1
  while [ $attempt -le 5 ]; do
    if curl -sfL -A "Mozilla/5.0" "https://commons.wikimedia.org/wiki/Special:FilePath/$name" -o "frontend/public/tarot/$num.jpg"; then
      echo "OK $num.jpg <- $name"
      return 0
    fi
    echo "retry $name (attempt $attempt)"
    sleep 3
    attempt=$((attempt + 1))
  done
  echo "FAILED: $num.jpg <- $name"
  return 1
}

# Wands: 22-35
download 22 Wands01.jpg
sleep 1
download 23 Wands02.jpg
sleep 1
download 24 Wands03.jpg
sleep 1
download 25 Wands04.jpg
sleep 1
download 26 Wands05.jpg
sleep 1
download 27 Wands06.jpg
sleep 1
download 28 Wands07.jpg
sleep 1
download 29 Wands08.jpg
sleep 1
download 30 Wands09.jpg
sleep 1
download 31 Wands10.jpg
sleep 1
download 32 Wands11.jpg
sleep 1
download 33 Wands12.jpg
sleep 1
download 34 Wands13.jpg
sleep 1
download 35 Wands14.jpg
sleep 1

# Cups: 36-49
download 36 Cups01.jpg
sleep 1
download 37 Cups02.jpg
sleep 1
download 38 Cups03.jpg
sleep 1
download 39 Cups04.jpg
sleep 1
download 40 Cups05.jpg
sleep 1
download 41 Cups06.jpg
sleep 1
download 42 Cups07.jpg
sleep 1
download 43 Cups08.jpg
sleep 1
download 44 Cups09.jpg
sleep 1
download 45 Cups10.jpg
sleep 1
download 46 Cups11.jpg
sleep 1
download 47 Cups12.jpg
sleep 1
download 48 Cups13.jpg
sleep 1
download 49 Cups14.jpg
sleep 1

# Swords: 50-63
download 50 Swords01.jpg
sleep 1
download 51 Swords02.jpg
sleep 1
download 52 Swords03.jpg
sleep 1
download 53 Swords04.jpg
sleep 1
download 54 Swords05.jpg
sleep 1
download 55 Swords06.jpg
sleep 1
download 56 Swords07.jpg
sleep 1
download 57 Swords08.jpg
sleep 1
download 58 Swords09.jpg
sleep 1
download 59 Swords10.jpg
sleep 1
download 60 Swords11.jpg
sleep 1
download 61 Swords12.jpg
sleep 1
download 62 Swords13.jpg
sleep 1
download 63 Swords14.jpg
sleep 1

# Pentacles (Wikimedia filename prefix is "Pents"): 64-77
download 64 Pents01.jpg
sleep 1
download 65 Pents02.jpg
sleep 1
download 66 Pents03.jpg
sleep 1
download 67 Pents04.jpg
sleep 1
download 68 Pents05.jpg
sleep 1
download 69 Pents06.jpg
sleep 1
download 70 Pents07.jpg
sleep 1
download 71 Pents08.jpg
sleep 1
download 72 Pents09.jpg
sleep 1
download 73 Pents10.jpg
sleep 1
download 74 Pents11.jpg
sleep 1
download 75 Pents12.jpg
sleep 1
download 76 Pents13.jpg
sleep 1
download 77 Pents14.jpg
```

- [ ] **Step 2: 전부 성공했는지, 실제 이미지 파일인지 확인**

Run:
```bash
ls frontend/public/tarot/*.jpg | wc -l
```
Expected: `78` (기존 22 + 신규 56)

Run:
```bash
file frontend/public/tarot/{22..77}.jpg | grep -v "JPEG image data"
```
Expected: 출력 없음 (전부 진짜 JPEG라는 뜻 — 만약 어떤 파일이 HTML 에러 페이지로 잘못 저장됐다면 이 명령이 그 파일명을 출력한다. 출력되는 파일이 있으면 Step 1의 `download` 함수로 해당 번호만 다시 받는다.)

- [ ] **Step 3: Commit**

```bash
git add frontend/public/tarot/22.jpg frontend/public/tarot/23.jpg frontend/public/tarot/24.jpg frontend/public/tarot/25.jpg frontend/public/tarot/26.jpg frontend/public/tarot/27.jpg frontend/public/tarot/28.jpg frontend/public/tarot/29.jpg frontend/public/tarot/30.jpg frontend/public/tarot/31.jpg frontend/public/tarot/32.jpg frontend/public/tarot/33.jpg frontend/public/tarot/34.jpg frontend/public/tarot/35.jpg frontend/public/tarot/36.jpg frontend/public/tarot/37.jpg frontend/public/tarot/38.jpg frontend/public/tarot/39.jpg frontend/public/tarot/40.jpg frontend/public/tarot/41.jpg frontend/public/tarot/42.jpg frontend/public/tarot/43.jpg frontend/public/tarot/44.jpg frontend/public/tarot/45.jpg frontend/public/tarot/46.jpg frontend/public/tarot/47.jpg frontend/public/tarot/48.jpg frontend/public/tarot/49.jpg frontend/public/tarot/50.jpg frontend/public/tarot/51.jpg frontend/public/tarot/52.jpg frontend/public/tarot/53.jpg frontend/public/tarot/54.jpg frontend/public/tarot/55.jpg frontend/public/tarot/56.jpg frontend/public/tarot/57.jpg frontend/public/tarot/58.jpg frontend/public/tarot/59.jpg frontend/public/tarot/60.jpg frontend/public/tarot/61.jpg frontend/public/tarot/62.jpg frontend/public/tarot/63.jpg frontend/public/tarot/64.jpg frontend/public/tarot/65.jpg frontend/public/tarot/66.jpg frontend/public/tarot/67.jpg frontend/public/tarot/68.jpg frontend/public/tarot/69.jpg frontend/public/tarot/70.jpg frontend/public/tarot/71.jpg frontend/public/tarot/72.jpg frontend/public/tarot/73.jpg frontend/public/tarot/74.jpg frontend/public/tarot/75.jpg frontend/public/tarot/76.jpg frontend/public/tarot/77.jpg
git commit -m "Add Minor Arcana card images (56) from the public-domain Rider-Waite-Smith deck"
```

---

### Task 3: 마이너 아르카나 56장 데이터 추가 + 테스트 갱신

**Files:**
- Modify: `frontend/lib/tarotCards.ts`
- Modify: `frontend/lib/tarotCards.test.ts`

**Interfaces:**
- Consumes: 기존 `TarotCard` 인터페이스, `CardDirection` 타입 (변경 없음)
- Produces: `TAROT_CARDS` 배열이 78개 항목을 가짐 — 이후 `/tarot` 페이지, `tarotNumberGenerator.ts` 등 기존에 `TAROT_CARDS`를 쓰는 모든 코드는 코드 변경 없이 그대로 78장으로 동작한다 (배열 길이에 의존하는 로직이 없음을 브레인스토밍 단계에서 확인함).

이 태스크는 Task 1(시드값 매핑), Task 2(이미지 파일)와 독립적으로 작성 가능하지만, 전체 기능이 실제로 동작하려면 세 태스크가 모두 끝나야 한다. 카드 56장을 부분적으로만 추가하면 아래 테스트가 78장을 기대하므로 실패한다 — 따라서 56장 전부와 테스트 갱신을 같은 커밋으로 묶는다.

- [ ] **Step 1: `TAROT_CARDS` 배열 끝에 마이너 아르카나 56장 추가**

`frontend/lib/tarotCards.ts`의 `TAROT_CARDS` 배열에서, 기존 21번(The World) 카드 항목 뒤, 배열을 닫는 `];` 바로 앞에 아래 56개 항목을 그대로 추가한다:

```ts
  {
    number: 22,
    nameEn: "Ace of Wands",
    nameKo: "지팡이 에이스",
    keyword: "새로운 열정",
    fortunes: {
      up: "새로운 열정이 솟아오르며 앞으로 나아갈 힘을 얻습니다.",
      down: "마음속에 품은 의지가 서서히 단단해지고 있어요.",
      left: "예전에 품었던 꿈이 다시 불씨를 지필 준비를 합니다.",
      right: "갑자기 떠오른 아이디어가 새로운 도전으로 이어질 수 있어요.",
    },
  },
  {
    number: 23,
    nameEn: "Two of Wands",
    nameKo: "지팡이 2",
    keyword: "계획, 큰 그림",
    fortunes: {
      up: "더 넓은 세상을 향한 계획이 구체적으로 그려지고 있습니다.",
      down: "지금 서 있는 자리를 다지면 다음 걸음이 훨씬 수월해져요.",
      left: "예전에 세워둔 계획을 다시 점검해볼 시점이에요.",
      right: "새로운 선택지가 눈앞에 나타나 고민이 깊어질 수 있어요.",
    },
  },
  {
    number: 24,
    nameEn: "Three of Wands",
    nameKo: "지팡이 3",
    keyword: "확장, 기대",
    fortunes: {
      up: "노력의 결과가 저 멀리서부터 서서히 다가오고 있습니다.",
      down: "지금의 안정적인 흐름이 앞으로의 확장을 뒷받침해줘요.",
      left: "예전에 뿌린 씨앗이 이제야 자라나는 중이에요.",
      right: "예상보다 빠르게 기회의 문이 열릴 수 있어요.",
    },
  },
  {
    number: 25,
    nameEn: "Four of Wands",
    nameKo: "지팡이 4",
    keyword: "축하, 안정",
    fortunes: {
      up: "함께한 사람들과 기쁨을 나눌 일이 생길 것 같아요.",
      down: "지금의 편안함과 안정감을 충분히 누려도 괜찮습니다.",
      left: "예전부터 쌓아온 관계가 든든한 울타리가 되어줍니다.",
      right: "작은 축하할 일이 예상치 못한 순간에 찾아옵니다.",
    },
  },
  {
    number: 26,
    nameEn: "Five of Wands",
    nameKo: "지팡이 5",
    keyword: "경쟁, 갈등",
    fortunes: {
      up: "크고 작은 부딪힘 속에서도 결국 성장할 기회를 얻습니다.",
      down: "지금의 다툼도 시간이 지나면 자연스레 가라앉을 거예요.",
      left: "예전의 경쟁이 지금의 실력을 만든 밑거름이었어요.",
      right: "갑작스러운 의견 충돌이 오히려 새로운 관점을 열어줍니다.",
    },
  },
  {
    number: 27,
    nameEn: "Six of Wands",
    nameKo: "지팡이 6",
    keyword: "승리, 인정",
    fortunes: {
      up: "그동안의 노력이 주변으로부터 인정받는 순간이 옵니다.",
      down: "스스로 이룬 성과를 자신 있게 받아들여도 좋아요.",
      left: "예전의 도전이 지금의 자신감으로 이어졌습니다.",
      right: "뜻밖의 곳에서 좋은 소식이 날아들 수 있어요.",
    },
  },
  {
    number: 28,
    nameEn: "Seven of Wands",
    nameKo: "지팡이 7",
    keyword: "방어, 소신",
    fortunes: {
      up: "흔들림 없이 자신의 입장을 지켜나가면 좋은 결과가 따라옵니다.",
      down: "지금은 묵묵히 버티는 것만으로도 충분한 힘이 됩니다.",
      left: "예전에 지켜온 원칙이 지금도 여전히 옳았음을 깨닫게 돼요.",
      right: "예상치 못한 도전이 와도 소신껏 맞서면 이겨낼 수 있어요.",
    },
  },
  {
    number: 29,
    nameEn: "Eight of Wands",
    nameKo: "지팡이 8",
    keyword: "속도, 진전",
    fortunes: {
      up: "막혀있던 일들이 한꺼번에 빠르게 풀려나갈 조짐이 보입니다.",
      down: "서두르지 않아도 흐름은 자연스럽게 제 속도를 찾아가요.",
      left: "예전부터 기다려온 소식이 곧 도착할 준비를 하고 있어요.",
      right: "갑작스럽게 일이 진행되며 예상보다 빠른 변화가 찾아옵니다.",
    },
  },
  {
    number: 30,
    nameEn: "Nine of Wands",
    nameKo: "지팡이 9",
    keyword: "인내, 방어",
    fortunes: {
      up: "지쳐 보여도 마지막 한 걸음만 더 내디디면 결실을 맺어요.",
      down: "지금까지 버텨온 스스로를 다독여줄 필요가 있습니다.",
      left: "예전의 시련이 지금의 단단함을 만들어줬어요.",
      right: "예상 밖의 지원군이 나타나 힘을 보태줄 수 있어요.",
    },
  },
  {
    number: 31,
    nameEn: "Ten of Wands",
    nameKo: "지팡이 10",
    keyword: "부담, 책임",
    fortunes: {
      up: "짊어진 짐이 무거워도 곧 내려놓을 순간이 다가옵니다.",
      down: "지금의 책임감이 훗날 든든한 자산이 되어줄 거예요.",
      left: "예전부터 떠안아온 부담을 조금씩 덜어내도 괜찮습니다.",
      right: "갑자기 늘어난 일들도 하나씩 처리하다 보면 가벼워져요.",
    },
  },
  {
    number: 32,
    nameEn: "Page of Wands",
    nameKo: "지팡이 시종",
    keyword: "호기심, 소식",
    fortunes: {
      up: "새로운 소식이나 제안이 설렘을 안고 찾아올 수 있어요.",
      down: "지금 품은 호기심을 천천히 키워나가도 좋습니다.",
      left: "예전에 배운 것이 다시 쓸모를 찾을 시기예요.",
      right: "예상치 못한 만남이 새로운 배움으로 이어질 수 있어요.",
    },
  },
  {
    number: 33,
    nameEn: "Knight of Wands",
    nameKo: "지팡이 기사",
    keyword: "모험, 추진력",
    fortunes: {
      up: "망설임 없이 뛰어들면 생각보다 좋은 결과를 얻을 수 있어요.",
      down: "지금은 속도를 조절하며 방향을 다시 살펴봐도 좋습니다.",
      left: "예전의 과감한 선택이 지금의 추진력으로 남아있어요.",
      right: "갑작스러운 제안이나 여행이 활력을 불어넣어 줄 수 있어요.",
    },
  },
  {
    number: 34,
    nameEn: "Queen of Wands",
    nameKo: "지팡이 여왕",
    keyword: "자신감, 매력",
    fortunes: {
      up: "당당한 태도가 주변 사람들에게 좋은 인상을 남깁니다.",
      down: "지금의 자신감을 잃지 않고 꾸준히 나아가면 충분해요.",
      left: "예전부터 다져온 매력이 자연스럽게 빛을 발하고 있어요.",
      right: "예상보다 많은 사람들의 관심과 지지를 받을 수 있어요.",
    },
  },
  {
    number: 35,
    nameEn: "King of Wands",
    nameKo: "지팡이 왕",
    keyword: "리더십, 비전",
    fortunes: {
      up: "큰 그림을 그리며 앞장서 이끌어야 할 순간이 왔습니다.",
      down: "지금의 경험이 흔들림 없는 판단력의 기반이 되어줘요.",
      left: "예전에 쌓은 리더십이 지금 빛을 발할 준비가 됐습니다.",
      right: "갑작스레 중요한 결정을 내려야 할 자리에 서게 될 수 있어요.",
    },
  },
  {
    number: 36,
    nameEn: "Ace of Cups",
    nameKo: "성배 에이스",
    keyword: "새로운 감정",
    fortunes: {
      up: "마음이 벅차오르는 새로운 감정이 찾아올 준비를 하고 있어요.",
      down: "지금의 잔잔한 감정을 있는 그대로 느껴봐도 좋습니다.",
      left: "예전에 느꼈던 설렘이 다시 살아날 수 있어요.",
      right: "예상치 못한 순간에 마음을 사로잡는 인연이 찾아올 수 있어요.",
    },
  },
  {
    number: 37,
    nameEn: "Two of Cups",
    nameKo: "성배 2",
    keyword: "연결, 파트너십",
    fortunes: {
      up: "서로를 이해하는 관계가 한 단계 더 깊어질 수 있어요.",
      down: "지금의 관계를 천천히 다져가는 것만으로도 충분합니다.",
      left: "예전의 인연이 다시 특별한 의미로 다가올 수 있어요.",
      right: "예상치 못한 만남이 좋은 파트너십으로 이어질 수 있어요.",
    },
  },
  {
    number: 38,
    nameEn: "Three of Cups",
    nameKo: "성배 3",
    keyword: "우정, 축하",
    fortunes: {
      up: "소중한 사람들과 함께 기쁨을 나눌 자리가 생길 것 같아요.",
      down: "지금 곁에 있는 사람들의 소중함을 다시금 느끼게 됩니다.",
      left: "예전부터 이어온 우정이 든든한 힘이 되어줍니다.",
      right: "갑작스러운 모임이나 소식이 즐거움을 더해줄 수 있어요.",
    },
  },
  {
    number: 39,
    nameEn: "Four of Cups",
    nameKo: "성배 4",
    keyword: "권태, 재고",
    fortunes: {
      up: "무심코 지나쳤던 기회를 다시 눈여겨볼 필요가 있어요.",
      down: "지금은 잠시 멈춰 마음을 정리하는 시간도 필요합니다.",
      left: "예전의 권태로움이 지금은 새로운 시선으로 바뀔 수 있어요.",
      right: "예상치 못한 제안이 무기력함을 깨워줄 수 있어요.",
    },
  },
  {
    number: 40,
    nameEn: "Five of Cups",
    nameKo: "성배 5",
    keyword: "상실, 후회",
    fortunes: {
      up: "아쉬움 속에서도 아직 남아있는 것들에 눈을 돌려보세요.",
      down: "지금의 서운함도 시간이 지나면 자연스레 옅어질 거예요.",
      left: "예전의 아쉬움을 완전히 흘려보내도 괜찮습니다.",
      right: "예상보다 빨리 마음을 추스르고 다시 일어설 수 있어요.",
    },
  },
  {
    number: 41,
    nameEn: "Six of Cups",
    nameKo: "성배 6",
    keyword: "추억, 향수",
    fortunes: {
      up: "그리운 기억이 지금의 마음을 따뜻하게 채워줍니다.",
      down: "지금 이 순간의 소박한 행복을 충분히 느껴보세요.",
      left: "예전의 좋은 기억이 다시 떠오르며 위로가 되어줍니다.",
      right: "오랜만에 그리운 사람에게서 연락이 올 수 있어요.",
    },
  },
  {
    number: 42,
    nameEn: "Seven of Cups",
    nameKo: "성배 7",
    keyword: "환상, 선택지",
    fortunes: {
      up: "여러 갈래의 가능성 중 마음이 이끄는 쪽을 믿어보세요.",
      down: "지금은 현실적인 기준으로 하나씩 정리해보는 게 좋아요.",
      left: "예전에 품었던 막연한 꿈을 구체화할 시점이 왔어요.",
      right: "예상치 못한 선택지가 갑자기 늘어날 수 있어요.",
    },
  },
  {
    number: 43,
    nameEn: "Eight of Cups",
    nameKo: "성배 8",
    keyword: "떠남, 탐색",
    fortunes: {
      up: "미련 없이 새로운 곳으로 발걸음을 옮길 준비가 됐어요.",
      down: "지금 자리를 정리하며 다음을 준비해도 좋습니다.",
      left: "예전에 두고 온 것에 더 이상 얽매이지 않아도 괜찮아요.",
      right: "갑작스러운 결정이 예상보다 홀가분함을 안겨줄 수 있어요.",
    },
  },
  {
    number: 44,
    nameEn: "Nine of Cups",
    nameKo: "성배 9",
    keyword: "만족, 소원성취",
    fortunes: {
      up: "바라던 일이 마음먹은 대로 이루어질 가능성이 큽니다.",
      down: "지금 가진 것들에 감사하면 만족감이 더 커질 거예요.",
      left: "예전부터 품어온 소원이 조용히 이루어지고 있어요.",
      right: "예상보다 빠르게 기쁜 소식을 듣게 될 수 있어요.",
    },
  },
  {
    number: 45,
    nameEn: "Ten of Cups",
    nameKo: "성배 10",
    keyword: "행복, 화합",
    fortunes: {
      up: "가까운 사람들과의 관계에서 깊은 행복을 느낄 수 있어요.",
      down: "지금의 평온한 일상이 가장 큰 행복임을 깨닫게 됩니다.",
      left: "예전부터 그려온 화목한 그림이 서서히 현실이 되고 있어요.",
      right: "예상치 못한 순간에 마음이 따뜻해지는 일이 생길 수 있어요.",
    },
  },
  {
    number: 46,
    nameEn: "Page of Cups",
    nameKo: "성배 시종",
    keyword: "창의적 소식",
    fortunes: {
      up: "감성을 자극하는 새로운 소식이나 제안이 찾아올 수 있어요.",
      down: "지금 떠오르는 직감을 가볍게 믿어봐도 좋습니다.",
      left: "예전에 품었던 감성적인 꿈이 다시 떠오를 수 있어요.",
      right: "예상치 못한 곳에서 다정한 마음을 전해받을 수 있어요.",
    },
  },
  {
    number: 47,
    nameEn: "Knight of Cups",
    nameKo: "성배 기사",
    keyword: "낭만, 제안",
    fortunes: {
      up: "마음을 설레게 하는 제안이나 고백이 찾아올 수 있어요.",
      down: "지금의 감정을 서두르지 않고 천천히 확인해봐도 좋아요.",
      left: "예전의 낭만적인 순간이 다시 그리워질 수 있어요.",
      right: "갑작스러운 만남이 특별한 인연으로 이어질 수 있어요.",
    },
  },
  {
    number: 48,
    nameEn: "Queen of Cups",
    nameKo: "성배 여왕",
    keyword: "공감, 직관",
    fortunes: {
      up: "따뜻한 공감과 배려가 주변 사람들에게 큰 위로가 됩니다.",
      down: "지금의 직관을 믿고 마음이 이끄는 대로 움직여도 좋아요.",
      left: "예전부터 지녀온 다정함이 지금도 변함없이 빛나고 있어요.",
      right: "예상치 못한 순간에 깊은 이해를 받는 경험을 하게 돼요.",
    },
  },
  {
    number: 49,
    nameEn: "King of Cups",
    nameKo: "성배 왕",
    keyword: "감정적 균형",
    fortunes: {
      up: "흔들리는 감정 속에서도 침착함을 유지하면 좋은 결과가 따라와요.",
      down: "지금의 안정된 마음가짐이 주변에도 좋은 영향을 줍니다.",
      left: "예전의 경험이 지금의 성숙한 판단력으로 이어졌어요.",
      right: "예상보다 어려운 상황에서도 의연하게 대처할 수 있어요.",
    },
  },
  {
    number: 50,
    nameEn: "Ace of Swords",
    nameKo: "검 에이스",
    keyword: "명료함, 돌파구",
    fortunes: {
      up: "복잡했던 생각이 명확해지며 돌파구가 보이기 시작합니다.",
      down: "지금의 차분한 판단력이 문제 해결의 열쇠가 되어줘요.",
      left: "예전부터 고민하던 문제의 답이 서서히 드러나고 있어요.",
      right: "갑작스러운 깨달음이 상황을 단번에 정리해줄 수 있어요.",
    },
  },
  {
    number: 51,
    nameEn: "Two of Swords",
    nameKo: "검 2",
    keyword: "결정 보류, 균형",
    fortunes: {
      up: "미뤄뒀던 결정을 이제는 마주할 준비가 되어가고 있어요.",
      down: "지금은 성급하게 정하지 않고 균형을 유지해도 괜찮습니다.",
      left: "예전부터 이어온 고민을 이제는 정리할 때가 됐어요.",
      right: "예상치 못한 정보가 결정을 도와줄 수 있어요.",
    },
  },
  {
    number: 52,
    nameEn: "Three of Swords",
    nameKo: "검 3",
    keyword: "마음의 상처",
    fortunes: {
      up: "아팠던 마음도 시간이 지나면 서서히 아물어갈 거예요.",
      down: "지금의 아픔을 억누르기보다 있는 그대로 인정해도 괜찮아요.",
      left: "예전의 상처가 지금은 더 단단한 마음으로 남았습니다.",
      right: "갑작스러운 솔직한 대화가 오히려 관계를 회복시켜줄 수 있어요.",
    },
  },
  {
    number: 53,
    nameEn: "Four of Swords",
    nameKo: "검 4",
    keyword: "휴식, 회복",
    fortunes: {
      up: "충분한 휴식 후에 다시 힘차게 나아갈 수 있을 거예요.",
      down: "지금은 무리하지 말고 잠시 멈춰 쉬어가도 좋습니다.",
      left: "예전의 지친 마음이 이제는 서서히 회복되고 있어요.",
      right: "예상치 못한 여유가 갑자기 찾아올 수 있어요.",
    },
  },
  {
    number: 54,
    nameEn: "Five of Swords",
    nameKo: "검 5",
    keyword: "갈등, 손실",
    fortunes: {
      up: "다툼보다 한 걸음 물러서는 것이 더 나은 결과를 만들어요.",
      down: "지금의 갈등도 시간이 지나면 자연스레 정리될 거예요.",
      left: "예전의 다툼에서 얻은 교훈이 지금 도움이 되고 있어요.",
      right: "예상치 못한 화해의 기회가 갑자기 찾아올 수 있어요.",
    },
  },
  {
    number: 55,
    nameEn: "Six of Swords",
    nameKo: "검 6",
    keyword: "전환, 이동",
    fortunes: {
      up: "어려운 시기를 지나 더 편안한 곳으로 나아가고 있어요.",
      down: "지금의 변화가 낯설어도 결국 좋은 방향으로 이어질 거예요.",
      left: "예전에 떠나온 자리가 지금 보면 옳은 선택이었어요.",
      right: "갑작스러운 이동이나 변화가 새로운 안정을 가져다줄 수 있어요.",
    },
  },
  {
    number: 56,
    nameEn: "Seven of Swords",
    nameKo: "검 7",
    keyword: "전략, 회피",
    fortunes: {
      up: "신중한 전략이 지금 상황을 유리하게 이끌어줄 수 있어요.",
      down: "지금은 드러내기보다 조용히 준비하는 편이 나을 수 있어요.",
      left: "예전에 세운 전략이 지금도 여전히 유효합니다.",
      right: "예상치 못한 잔꾀보다 정직한 태도가 더 좋은 결과를 가져와요.",
    },
  },
  {
    number: 57,
    nameEn: "Eight of Swords",
    nameKo: "검 8",
    keyword: "속박, 제한된 생각",
    fortunes: {
      up: "스스로를 가두던 생각에서 벗어날 용기가 필요해요.",
      down: "지금의 답답함도 관점을 바꾸면 실마리가 보일 거예요.",
      left: "예전의 두려움이 지금은 더 이상 걸림돌이 아니에요.",
      right: "예상치 못한 계기로 갑갑했던 상황이 풀려나갈 수 있어요.",
    },
  },
  {
    number: 58,
    nameEn: "Nine of Swords",
    nameKo: "검 9",
    keyword: "불안, 걱정",
    fortunes: {
      up: "걱정이 크게 느껴져도 실제로는 잘 지나갈 가능성이 높아요.",
      down: "지금의 불안한 마음을 혼자 끌어안지 않아도 괜찮습니다.",
      left: "예전의 걱정이 지나고 보면 별일 아니었음을 알게 될 거예요.",
      right: "예상치 못한 안심되는 소식이 불안을 잠재워줄 수 있어요.",
    },
  },
  {
    number: 59,
    nameEn: "Ten of Swords",
    nameKo: "검 10",
    keyword: "끝, 바닥",
    fortunes: {
      up: "힘든 시기가 끝나고 새로운 시작이 기다리고 있어요.",
      down: "지금이 바닥이라면 이제 올라갈 일만 남았습니다.",
      left: "예전의 힘들었던 일은 이제 완전히 매듭지어도 괜찮아요.",
      right: "예상보다 빠르게 상황이 마무리되고 전환점을 맞을 수 있어요.",
    },
  },
  {
    number: 60,
    nameEn: "Page of Swords",
    nameKo: "검 시종",
    keyword: "호기심, 경계",
    fortunes: {
      up: "예리한 관찰력이 유용한 정보를 알아채게 해줄 거예요.",
      down: "지금은 성급히 판단하기보다 좀 더 지켜봐도 좋습니다.",
      left: "예전에 배운 경계심이 지금도 도움이 되고 있어요.",
      right: "예상치 못한 소식이나 소문이 들려올 수 있어요.",
    },
  },
  {
    number: 61,
    nameEn: "Knight of Swords",
    nameKo: "검 기사",
    keyword: "성급함, 추진력",
    fortunes: {
      up: "거침없는 추진력이 목표에 빠르게 다가가게 해줄 거예요.",
      down: "지금은 속도를 늦추고 신중하게 움직이는 게 좋습니다.",
      left: "예전의 성급했던 선택에서 얻은 교훈이 지금 도움이 돼요.",
      right: "갑작스러운 결단이 예상보다 빠른 결과를 만들어낼 수 있어요.",
    },
  },
  {
    number: 62,
    nameEn: "Queen of Swords",
    nameKo: "검 여왕",
    keyword: "명확한 판단",
    fortunes: {
      up: "흔들림 없는 판단력이 복잡한 상황을 정리해줄 거예요.",
      down: "지금의 냉철함이 오히려 주변에 신뢰를 줍니다.",
      left: "예전의 경험에서 얻은 통찰이 지금 빛을 발하고 있어요.",
      right: "예상치 못한 진실이 명확하게 드러날 수 있어요.",
    },
  },
  {
    number: 63,
    nameEn: "King of Swords",
    nameKo: "검 왕",
    keyword: "권위, 논리",
    fortunes: {
      up: "논리적인 접근이 어려운 문제를 명쾌하게 풀어줄 거예요.",
      down: "지금의 원칙을 지키는 태도가 좋은 결과로 이어집니다.",
      left: "예전에 세운 기준이 지금도 흔들림 없이 유효해요.",
      right: "예상치 못한 중요한 결정을 내려야 할 순간이 올 수 있어요.",
    },
  },
  {
    number: 64,
    nameEn: "Ace of Pentacles",
    nameKo: "오망성 에이스",
    keyword: "새로운 기회",
    fortunes: {
      up: "실질적인 기회가 눈앞에 나타나 앞으로의 토대가 되어줄 거예요.",
      down: "지금 다지는 기반이 앞으로 오래도록 든든하게 남습니다.",
      left: "예전에 뿌린 노력의 씨앗이 이제 싹을 틔울 준비를 해요.",
      right: "예상치 못한 곳에서 뜻밖의 제안이 들어올 수 있어요.",
    },
  },
  {
    number: 65,
    nameEn: "Two of Pentacles",
    nameKo: "오망성 2",
    keyword: "균형, 우선순위",
    fortunes: {
      up: "여러 일 사이의 균형을 잘 잡으면 무리 없이 해낼 수 있어요.",
      down: "지금은 우선순위를 다시 정리해보는 것도 좋은 방법이에요.",
      left: "예전부터 이어온 균형 감각이 지금도 도움이 되고 있어요.",
      right: "예상치 못하게 여러 일이 한꺼번에 몰려올 수 있어요.",
    },
  },
  {
    number: 66,
    nameEn: "Three of Pentacles",
    nameKo: "오망성 3",
    keyword: "협업, 숙련",
    fortunes: {
      up: "함께하는 사람들과의 협업이 좋은 결실로 이어질 거예요.",
      down: "지금의 꾸준한 노력이 실력으로 차곡차곡 쌓이고 있어요.",
      left: "예전에 함께한 사람들과의 인연이 다시 이어질 수 있어요.",
      right: "예상치 못한 협업 제안이 좋은 기회가 되어줄 수 있어요.",
    },
  },
  {
    number: 67,
    nameEn: "Four of Pentacles",
    nameKo: "오망성 4",
    keyword: "안정, 집착",
    fortunes: {
      up: "지금 가진 것을 지키려는 마음이 조금은 여유를 가져도 괜찮아요.",
      down: "지금의 안정감을 유지하는 것도 충분히 의미 있는 선택이에요.",
      left: "예전부터 지켜온 것들의 소중함을 다시 느끼게 됩니다.",
      right: "예상치 못한 지출이나 변화에 마음을 열어두는 게 좋아요.",
    },
  },
  {
    number: 68,
    nameEn: "Five of Pentacles",
    nameKo: "오망성 5",
    keyword: "어려움, 결핍",
    fortunes: {
      up: "어려운 시기 속에서도 도움의 손길이 가까이 있을 거예요.",
      down: "지금의 부족함이 오히려 소중한 것을 알아보게 해줍니다.",
      left: "예전의 어려웠던 시절이 지금의 강인함을 만들어줬어요.",
      right: "예상치 못한 도움이 갑작스레 나타날 수 있어요.",
    },
  },
  {
    number: 69,
    nameEn: "Six of Pentacles",
    nameKo: "오망성 6",
    keyword: "나눔, 균형",
    fortunes: {
      up: "주고받는 것의 균형이 맞을 때 관계가 더 편안해집니다.",
      down: "지금 베푸는 마음이 언젠가 좋은 형태로 돌아올 거예요.",
      left: "예전에 받았던 도움을 이제는 갚을 차례일 수 있어요.",
      right: "예상치 못한 도움이나 지원을 받게 될 수 있어요.",
    },
  },
  {
    number: 70,
    nameEn: "Seven of Pentacles",
    nameKo: "오망성 7",
    keyword: "인내, 평가",
    fortunes: {
      up: "조급해하지 않고 기다리면 노력의 결실을 보게 될 거예요.",
      down: "지금은 그동안의 성과를 차분히 점검해보는 시간이에요.",
      left: "예전에 심어둔 노력이 이제 서서히 자라나고 있어요.",
      right: "예상보다 빠르게 결과가 눈에 보이기 시작할 수 있어요.",
    },
  },
  {
    number: 71,
    nameEn: "Eight of Pentacles",
    nameKo: "오망성 8",
    keyword: "숙련, 노력",
    fortunes: {
      up: "꾸준한 연습과 노력이 실력을 한 단계 끌어올려 줄 거예요.",
      down: "지금 하는 반복적인 노력이 결코 헛되지 않습니다.",
      left: "예전부터 갈고닦은 기술이 지금 빛을 발하고 있어요.",
      right: "예상치 못한 배움의 기회가 찾아올 수 있어요.",
    },
  },
  {
    number: 72,
    nameEn: "Nine of Pentacles",
    nameKo: "오망성 9",
    keyword: "풍요, 독립",
    fortunes: {
      up: "스스로 이룬 결실을 온전히 누릴 자격이 충분해요.",
      down: "지금의 여유로움을 자신에게 선물해줘도 좋습니다.",
      left: "예전부터 쌓아온 노력이 지금의 풍요로 돌아왔어요.",
      right: "예상치 못한 뜻밖의 보상이 찾아올 수 있어요.",
    },
  },
  {
    number: 73,
    nameEn: "Ten of Pentacles",
    nameKo: "오망성 10",
    keyword: "유산, 안정",
    fortunes: {
      up: "오랜 노력이 가족이나 공동체의 든든한 기반이 되어줄 거예요.",
      down: "지금의 안정이 앞으로도 오래도록 이어질 가능성이 커요.",
      left: "예전부터 쌓아온 것들이 지금의 든든함으로 남았습니다.",
      right: "예상치 못한 곳에서 뜻깊은 유산이나 기회를 얻을 수 있어요.",
    },
  },
  {
    number: 74,
    nameEn: "Page of Pentacles",
    nameKo: "오망성 시종",
    keyword: "배움, 계획",
    fortunes: {
      up: "새로운 배움이나 계획이 실질적인 결실로 이어질 수 있어요.",
      down: "지금 차근차근 세우는 계획이 든든한 토대가 되어줍니다.",
      left: "예전에 세워둔 목표를 다시 점검해볼 시점이에요.",
      right: "예상치 못한 배움의 기회나 제안이 찾아올 수 있어요.",
    },
  },
  {
    number: 75,
    nameEn: "Knight of Pentacles",
    nameKo: "오망성 기사",
    keyword: "근면, 신중함",
    fortunes: {
      up: "꾸준하고 성실한 태도가 결국 좋은 결과로 이어질 거예요.",
      down: "지금의 신중함이 실수를 줄이고 안정을 가져다줍니다.",
      left: "예전부터 지켜온 성실함이 지금의 신뢰로 이어졌어요.",
      right: "예상보다 느리더라도 확실한 진전을 이룰 수 있어요.",
    },
  },
  {
    number: 76,
    nameEn: "Queen of Pentacles",
    nameKo: "오망성 여왕",
    keyword: "실용성, 풍요",
    fortunes: {
      up: "현실적인 감각이 안정과 풍요를 동시에 가져다줄 거예요.",
      down: "지금 돌보고 있는 것들에 정성을 쏟으면 좋은 결실이 와요.",
      left: "예전부터 다져온 살림살이의 지혜가 지금도 빛을 발해요.",
      right: "예상치 못한 풍족함이나 안정이 찾아올 수 있어요.",
    },
  },
  {
    number: 77,
    nameEn: "King of Pentacles",
    nameKo: "오망성 왕",
    keyword: "성공, 안정된 부",
    fortunes: {
      up: "그동안 쌓아온 노력이 확고한 성공으로 자리 잡을 거예요.",
      down: "지금의 안정된 기반이 앞으로도 든든하게 이어집니다.",
      left: "예전부터 다져온 기반이 지금의 성공을 뒷받침해줘요.",
      right: "예상치 못한 큰 성과나 인정을 받게 될 수 있어요.",
    },
  },
```

- [ ] **Step 2: `tarotCards.test.ts` 갱신**

`frontend/lib/tarotCards.test.ts`에서 다음 부분:

```ts
  it("has exactly 22 Major Arcana cards numbered 0-21 with no duplicates", () => {
    expect(TAROT_CARDS).toHaveLength(22);
    const numbers = TAROT_CARDS.map((c) => c.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 22 }, (_, i) => i));
  });
```

를 다음으로 교체:

```ts
  it("has exactly 78 cards numbered 0-77 with no duplicates", () => {
    expect(TAROT_CARDS).toHaveLength(78);
    const numbers = TAROT_CARDS.map((c) => c.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 78 }, (_, i) => i));
  });

  it("assigns each minor arcana suit a contiguous 14-card block in the expected order", () => {
    const wands = TAROT_CARDS.filter((c) => c.number >= 22 && c.number <= 35);
    const cups = TAROT_CARDS.filter((c) => c.number >= 36 && c.number <= 49);
    const swords = TAROT_CARDS.filter((c) => c.number >= 50 && c.number <= 63);
    const pentacles = TAROT_CARDS.filter((c) => c.number >= 64 && c.number <= 77);

    expect(wands).toHaveLength(14);
    expect(cups).toHaveLength(14);
    expect(swords).toHaveLength(14);
    expect(pentacles).toHaveLength(14);

    expect(wands.every((c) => c.nameEn.includes("Wands"))).toBe(true);
    expect(cups.every((c) => c.nameEn.includes("Cups"))).toBe(true);
    expect(swords.every((c) => c.nameEn.includes("Swords"))).toBe(true);
    expect(pentacles.every((c) => c.nameEn.includes("Pentacles"))).toBe(true);
  });
```

(테스트 파일의 나머지 부분 — `"gives every card all 4 direction fortunes"`, `shuffleCards` 관련 `describe` 블록 — 은 그대로 둔다. `TAROT_CARDS.length`를 하드코딩하지 않고 참조하므로 78장에도 그대로 통과한다.)

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npx vitest run lib/tarotCards.test.ts`
Expected: 전부 통과 (78장, 수트별 14장씩, 전 카드 4방향 운세 보유)

- [ ] **Step 4: 전체 프론트 타입체크 + 테스트 스위트**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 통과 (Task 1에서 갱신한 `tarotNumberGenerator.test.ts`도 포함)

- [ ] **Step 5: 브라우저에서 카드 스프레드 확인**

Task 2의 이미지가 이미 받아져 있다는 전제 하에, 로컬 dev 서버에서 `/tarot` → 아무 모드나 선택 → 카드 스프레드가 78장으로 늘어난 것을 확인 (그리드가 카드 수에 자동으로 맞춰지므로 레이아웃이 깨지지 않아야 한다). 카드 하나를 뽑아 뒤집었을 때 마이너 아르카나 카드(22번 이상)의 이미지도 정상적으로 로드되는지 확인 — 로그인 없이도 카드 뽑기 자체는 가능하므로 이 확인에 별도 인증이 필요 없다.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/tarotCards.ts frontend/lib/tarotCards.test.ts
git commit -m "Add the 56-card Minor Arcana to reach a full 78-card tarot deck"
```

---

## 배포 참고사항 (이 플랜 밖의 수동 작업)

없음 — 이번 확장은 프론트엔드 전용 변경(정적 데이터 + 이미지 파일)이라 백엔드/DB 마이그레이션이 필요 없다. `git push` 한 번으로 Vercel에 반영된다.

## 셀프 리뷰 메모

- **스펙 커버리지:** 설계 문서의 번호 체계, 시드값 매핑, 이미지 출처, 콘텐츠 톤 요구사항이 모두 Task 1~3에 반영됨.
- **플레이스홀더 스캔:** "TBD"/"나중에" 없음 — 56장 전부 완성된 이름/키워드/4방향 문구 포함.
- **타입 일관성:** 신규 카드 56개 전부 기존 `TarotCard` 인터페이스(`number, nameEn, nameKo, keyword, fortunes`)를 그대로 따름 — 필드명/구조 변경 없음.
- **번호 중복 검사:** 22~77 범위에서 수동으로 순서대로 부여했으며, Task 3의 테스트(`has exactly 78 cards numbered 0-77 with no duplicates`)가 중복/누락을 자동으로 검증한다.
