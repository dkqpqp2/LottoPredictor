import { describe, expect, it } from "vitest";
import { TAROT_CARDS, shuffleCards, buildFanDeck, FAN_SIZE } from "./tarotCards";

describe("TAROT_CARDS", () => {
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

  it("gives every card all 4 direction fortunes", () => {
    for (const card of TAROT_CARDS) {
      expect(card.fortunes.up).toBeTruthy();
      expect(card.fortunes.down).toBeTruthy();
      expect(card.fortunes.left).toBeTruthy();
      expect(card.fortunes.right).toBeTruthy();
    }
  });
});

describe("shuffleCards", () => {
  it("returns a permutation containing the same cards", () => {
    const shuffled = shuffleCards(TAROT_CARDS);
    expect(shuffled).toHaveLength(TAROT_CARDS.length);
    expect(new Set(shuffled.map((c) => c.number))).toEqual(new Set(TAROT_CARDS.map((c) => c.number)));
  });

  it("does not mutate the input array", () => {
    const original = [...TAROT_CARDS];
    shuffleCards(TAROT_CARDS);
    expect(TAROT_CARDS).toEqual(original);
  });
});

describe("buildFanDeck", () => {
  it("returns FAN_SIZE cards when the pool is large enough", () => {
    const deck = buildFanDeck(TAROT_CARDS, new Set());
    expect(deck).toHaveLength(FAN_SIZE);
  });

  it("excludes card numbers passed in the exclude set", () => {
    const excluded = new Set([0, 1, 2]);
    const deck = buildFanDeck(TAROT_CARDS, excluded, 75);
    expect(deck.some((c) => excluded.has(c.number))).toBe(false);
  });

  it("returns fewer cards than count when the pool after exclusion is smaller", () => {
    const excluded = new Set(TAROT_CARDS.slice(3).map((c) => c.number));
    const deck = buildFanDeck(TAROT_CARDS, excluded, FAN_SIZE);
    expect(deck).toHaveLength(3);
  });

  it("respects a custom count", () => {
    const deck = buildFanDeck(TAROT_CARDS, new Set(), 5);
    expect(deck).toHaveLength(5);
  });

  it("does not mutate the input pool", () => {
    const original = [...TAROT_CARDS];
    buildFanDeck(TAROT_CARDS, new Set());
    expect(TAROT_CARDS).toEqual(original);
  });
});
