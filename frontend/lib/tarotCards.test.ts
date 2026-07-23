import { describe, expect, it } from "vitest";
import { TAROT_CARDS, shuffleCards } from "./tarotCards";

describe("TAROT_CARDS", () => {
  it("has exactly 22 Major Arcana cards numbered 0-21 with no duplicates", () => {
    expect(TAROT_CARDS).toHaveLength(22);
    const numbers = TAROT_CARDS.map((c) => c.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 22 }, (_, i) => i));
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
