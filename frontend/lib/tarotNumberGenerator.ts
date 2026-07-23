import type { CardDirection, TarotCard } from "./tarotCards";
import type { ZodiacSign } from "./zodiac";

const CARD_SEED_WEIGHT = 8;
const ZODIAC_WEIGHT = 5;
const DIRECTION_BOOST = 2;
const MIN_NUMBER = 1;
const MAX_NUMBER = 45;

export function cardSeedNumber(card: TarotCard): number {
  return card.number === 0 ? 22 : card.number;
}

function isInDirectionRange(n: number, direction: CardDirection, seed: number): boolean {
  switch (direction) {
    case "up":
      return n >= 24 && n <= MAX_NUMBER;
    case "down":
      return n >= MIN_NUMBER && n <= 23;
    case "left":
      return Math.abs(n - seed) <= 5;
    case "right":
      return Math.abs(n - seed) > 5;
  }
}

/** Index 0 is unused; weights live at indexes 1..45 to match lotto numbers directly. */
export function buildWeights(card: TarotCard, zodiac: ZodiacSign, direction: CardDirection): number[] {
  const weights = new Array(MAX_NUMBER + 1).fill(0);
  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
    weights[n] = 1;
  }

  const seed = cardSeedNumber(card);
  for (const n of [seed, seed + 22]) {
    if (n >= MIN_NUMBER && n <= MAX_NUMBER) weights[n] += CARD_SEED_WEIGHT;
  }

  for (const n of zodiac.luckyNumbers) {
    if (n >= MIN_NUMBER && n <= MAX_NUMBER) weights[n] += ZODIAC_WEIGHT;
  }

  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
    if (isInDirectionRange(n, direction, seed)) weights[n] += DIRECTION_BOOST;
  }

  return weights;
}

export function weightedSampleWithoutReplacement(weights: number[], count: number): number[] {
  const pool: { n: number; w: number }[] = [];
  for (let n = 1; n < weights.length; n++) {
    if (weights[n] > 0) pool.push({ n, w: weights[n] });
  }

  const picked: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((sum, p) => sum + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    picked.push(pool[idx].n);
    pool.splice(idx, 1);
  }

  return picked;
}

export function generateTarotNumbers(card: TarotCard, zodiac: ZodiacSign, direction: CardDirection): number[] {
  const weights = buildWeights(card, zodiac, direction);
  return weightedSampleWithoutReplacement(weights, 6).sort((a, b) => a - b);
}
