# Tarot Fortune Numbers — Design

## Overview

A new "타로" page that lets a visitor draw one of the 22 Major Arcana tarot
cards (shuffled, face-down, picked blind) plus their zodiac sign (from
birthdate), and combines both into a themed set of 6 lotto numbers. This is
an entertainment feature, not a prediction — same "재미로만 참고" framing
as the rest of the app.

## Goals

- Let a user pick a face-down card from a shuffled 22-card spread, drag it
  in one of 4 directions to reveal it, and see a short fortune (card name +
  keyword + zodiac blurb).
- Generate 6 lotto numbers themed by the card + direction + zodiac
  combination, reusing the app's existing weighted-random-sampling
  approach (just with a different weight source than historical frequency).
- Give the page a distinct, always-dark "우주/신비" visual identity,
  independent of the site's light/dark mode setting.

## Non-goals (for this iteration)

- The 56 Minor Arcana cards — deferred; ship 22 Major Arcana first, add the
  rest later if it proves popular. The card data structure should not make
  adding them later awkward, but no Minor Arcana content is authored now.
- Saving a user's draw history or tying it to an account — there is no
  login yet ([[project-lotto-predictor-auth-decision]]); this feature is
  stateless per visit.
- Any backend/DB involvement — see Architecture below.

## User Flow

1. User opens `/tarot`.
2. Enters their birthdate (reuse the styled date input pattern from the
   redesigned draws-page search form). The app derives their zodiac sign
   client-side from the date (standard 12-sign date ranges).
3. 22 face-down cards are shown in a shuffled order (re-shuffled on every
   page load and on every "다시 뽑기" / reset), so the user cannot learn
   which position is which card over repeated visits.
4. User clicks one face-down card.
5. The chosen card enters a "reveal" state: the user drags it in one of 4
   directions (위/아래/왼쪽/오른쪽). The drag direction is captured on
   release.
6. The card flips to show its front (name, Roman numeral, keyword) plus a
   short fortune line combining the direction's meaning and the user's
   zodiac sign.
7. A "번호 뽑기" button generates and displays 6 numbers using the
   algorithm below.
8. A "다시 뽑기" action resets the spread (re-shuffles, clears the reveal).

## Visual Design

The `/tarot` page always renders with a fixed dark "cosmic" theme
(deep indigo/navy background, subtle star-field, gold/lavender accent
color for card fronts and buttons) regardless of the site's
light/dark-mode setting — this page intentionally does not follow
`prefers-color-scheme` the way the rest of the app does, since the
mystical tone is the point of the page. Card backs use a simple custom
SVG/CSS pattern (moon/star motif), not photographed/licensed tarot
artwork — consistent with the rest of the app never using external image
assets.

## Card Data Model

22 Major Arcana, using the standard Rider-Waite-Smith numbering/order:

| # | Name (EN) | 한글 | Keyword |
|---|---|---|---|
| 0 | The Fool | 바보 | 새로운 시작 |
| 1 | The Magician | 마법사 | 창조, 의지 |
| 2 | The High Priestess | 여사제 | 직관, 신비 |
| 3 | The Empress | 여황제 | 풍요, 성장 |
| 4 | The Emperor | 황제 | 안정, 권위 |
| 5 | The Hierophant | 교황 | 전통, 가르침 |
| 6 | The Lovers | 연인 | 선택, 관계 |
| 7 | The Chariot | 전차 | 의지, 전진 |
| 8 | Strength | 힘 | 용기, 인내 |
| 9 | The Hermit | 은둔자 | 성찰, 탐구 |
| 10 | Wheel of Fortune | 운명의 수레바퀴 | 전환, 순환 |
| 11 | Justice | 정의 | 균형, 인과 |
| 12 | The Hanged Man | 매달린 사람 | 관점 전환, 기다림 |
| 13 | Death | 죽음 | 끝과 시작 |
| 14 | Temperance | 절제 | 조화, 균형 |
| 15 | The Devil | 악마 | 유혹, 속박 |
| 16 | The Tower | 탑 | 급변, 깨달음 |
| 17 | The Star | 별 | 희망, 영감 |
| 18 | The Moon | 달 | 불안, 잠재의식 |
| 19 | The Sun | 태양 | 성공, 활력 |
| 20 | Judgement | 심판 | 각성, 부활 |
| 21 | The World | 세계 | 완성, 성취 |

Each card also carries 4 direction-specific one-line fortune texts. Only
The Fool's are fully authored here as the template; the remaining 21
cards' direction texts follow the same pattern and are written during
implementation (this is a content-authoring task, not a structural
question):

```
The Fool (0):
  up:    "새로운 문이 열립니다 — 두려움 없이 첫걸음을 내디뎌 보세요."
  down:  "지금 이 순간에 집중하면 안정감을 찾을 수 있어요."
  left:  "과거의 경험이 지금의 선택에 힌트를 줍니다."
  right: "작은 행동 하나가 예상치 못한 변화를 만듭니다."
```

## Zodiac Data Model

12 signs, standard date ranges, each with 3 curated "lucky numbers" in
1–45 (chosen for thematic fit and spread across the range — not a claim
of numerological authority, just curated for variety):

| 별자리 | 기간 | 행운의 숫자 |
|---|---|---|
| 양자리 (Aries) | 3/21–4/19 | 9, 18, 27 |
| 황소자리 (Taurus) | 4/20–5/20 | 6, 24, 33 |
| 쌍둥이자리 (Gemini) | 5/21–6/21 | 5, 14, 32 |
| 게자리 (Cancer) | 6/22–7/22 | 2, 20, 29 |
| 사자자리 (Leo) | 7/23–8/22 | 1, 19, 37 |
| 처녀자리 (Virgo) | 8/23–9/22 | 15, 23, 41 |
| 천칭자리 (Libra) | 9/23–10/22 | 6, 21, 39 |
| 전갈자리 (Scorpio) | 10/23–11/21 | 8, 26, 44 |
| 사수자리 (Sagittarius) | 11/22–12/21 | 3, 12, 30 |
| 염소자리 (Capricorn) | 12/22–1/19 | 10, 22, 40 |
| 물병자리 (Aquarius) | 1/20–2/18 | 11, 29, 38 |
| 물고기자리 (Pisces) | 2/19–3/20 | 7, 16, 34 |

## Direction Mechanic

Dragging the chosen card in a direction on reveal selects one of 4
meaning modifiers, which also shifts which part of the 1–45 range gets
extra weight in the number generation:

| Direction | Theme | Number-range boost |
|---|---|---|
| 위 (up) | 미래 지향 / 도약 | upper half (24–45) |
| 아래 (down) | 현실 / 안정 | lower half (1–23) |
| 왼쪽 (left) | 과거 / 직관 | numbers near the card's number (±5) |
| 오른쪽 (right) | 행동 / 변화 | numbers far from the card's number |

("The card's number" here always means the substituted value used in the
algorithm below — i.e. 22 for The Fool, not 0 — so range math stays inside
1–45 for every card.)

## Number Generation Algorithm

Pure client-side (TypeScript), no backend call. Build a 1–45 weight array,
then run weighted-sampling-without-replacement (same pattern as the
backend's `WeightedRandomSampler`, reimplemented in the frontend since the
weight source here is unrelated to historical draw data):

1. Start every number 1–45 at base weight `1`.
2. Card seed numbers: `cardNumber === 0 ? 22 : cardNumber` and
   `(cardNumber === 0 ? 22 : cardNumber) + 22` each get weight `+8`.
3. Zodiac's 3 curated lucky numbers each get weight `+5`.
4. Direction's range boost: every number in the boosted range/criterion
   (see table above) gets an additional `+2`.
5. Run weighted sampling 6 times without replacement over the resulting
   weight array to produce the final 6 numbers (sorted ascending for
   display).

This guarantees the card and zodiac's signature numbers are likely (but
not guaranteed) to appear, while direction subtly reshapes the odds across
the rest of the range — output feels thematically connected without being
fully deterministic.

## Technical Architecture

- New route: `frontend/app/tarot/page.tsx` + `tarot.module.css` (dark
  cosmic theme scoped to this page only).
- New static content module: `frontend/lib/tarotCards.ts` (22-card array:
  number, name, keyword, 4 direction texts) and `frontend/lib/zodiac.ts`
  (12-sign array: date range, name, lucky numbers, `getZodiacSign(date)`
  helper).
- New pure logic module: `frontend/lib/tarotNumberGenerator.ts`
  implementing the weight-building + weighted-sampling algorithm above,
  unit-testable in isolation (pure functions, no DOM/React dependency).
- New nav entry "타로" in `frontend/app/components/Nav.tsx`.
- No backend changes, no new DB tables, no new API endpoints — this
  feature reads/writes nothing server-side.

## Testing

- Vitest unit tests for `tarotNumberGenerator.ts`: weight array
  construction (card seed numbers get boosted, zodiac numbers get
  boosted, direction range boost applied correctly), and the sampler
  produces exactly 6 unique numbers in range 1–45 across many runs.
- Vitest unit tests for `zodiac.ts`: `getZodiacSign(date)` correctly
  classifies boundary dates (e.g., Dec 21 vs Dec 22 falls on different
  signs), including the Capricorn wraparound (Dec 22–Jan 19 crosses year
  boundary).
- Manual browser verification of the shuffle/pick/reveal/drag-direction
  flow and the always-dark theme.

## Future Extensions (explicitly out of scope now)

- Minor Arcana (56 cards) if the Major-Arcana-only version gets good
  engagement.
- Persisting a user's draw history once member accounts
  ([[project-lotto-predictor-auth-decision]]) exist.
- Tying tarot draws into the future gamification/points system
  ([[project-lotto-predictor-gamification-idea]]) — e.g., a bonus point
  bump for drawing on a "streak."
