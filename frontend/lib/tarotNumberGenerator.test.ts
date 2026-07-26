import { describe, expect, it } from "vitest";
import {
  buildWeights,
  cardSeedNumber,
  generateTarotNumberSets,
  weightedSampleWithoutReplacement,
} from "./tarotNumberGenerator";
import { TAROT_CARDS } from "./tarotCards";
import { ZODIAC_SIGNS } from "./zodiac";

const star = TAROT_CARDS.find((c) => c.nameEn === "The Star")!; // number 17
const fool = TAROT_CARDS.find((c) => c.nameEn === "The Fool")!; // number 0
const aries = ZODIAC_SIGNS.find((z) => z.id === "aries")!; // luckyNumbers [9, 18, 27]

describe("cardSeedNumber", () => {
  it("substitutes 22 for The Fool's card number 0", () => {
    expect(cardSeedNumber(fool)).toBe(22);
  });

  it("uses the card's own tarot number otherwise", () => {
    expect(cardSeedNumber(star)).toBe(17);
  });
});

describe("buildWeights", () => {
  it("boosts the card's seed number and its +22 pair", () => {
    const weights = buildWeights(star, aries, "down");
    expect(weights[17]).toBeGreaterThanOrEqual(1 + 8);
    expect(weights[39]).toBeGreaterThanOrEqual(1 + 8);
  });

  it("boosts the zodiac's lucky numbers", () => {
    const weights = buildWeights(star, aries, "down");
    expect(weights[9]).toBeGreaterThanOrEqual(1 + 5);
    expect(weights[18]).toBeGreaterThanOrEqual(1 + 5);
    expect(weights[27]).toBeGreaterThanOrEqual(1 + 5);
  });

  it("boosts the upper half of the range for the 'up' direction", () => {
    const weights = buildWeights(star, aries, "up");
    expect(weights[45]).toBeGreaterThan(weights[1]);
  });

  it("boosts the lower half of the range for the 'down' direction", () => {
    const weights = buildWeights(star, aries, "down");
    expect(weights[1]).toBeGreaterThan(weights[45]);
  });

  it("boosts numbers near the card's seed for the 'left' direction", () => {
    const weights = buildWeights(star, aries, "left"); // seed = 17
    expect(weights[20]).toBeGreaterThan(weights[40]);
  });

  it("boosts numbers far from the card's seed for the 'right' direction", () => {
    const weights = buildWeights(star, aries, "right"); // seed = 17
    expect(weights[40]).toBeGreaterThan(weights[20]);
  });

  it("leaves every number in range at a positive weight", () => {
    const weights = buildWeights(star, aries, "down");
    for (let n = 1; n <= 45; n++) {
      expect(weights[n]).toBeGreaterThan(0);
    }
  });

  it("still boosts the card's seed number when no zodiac is given", () => {
    const weights = buildWeights(star, null, "down");
    expect(weights[17]).toBeGreaterThanOrEqual(1 + 8);
    expect(weights[39]).toBeGreaterThanOrEqual(1 + 8);
  });

  it("does not boost any number for the zodiac's lucky numbers when no zodiac is given", () => {
    const withZodiac = buildWeights(star, aries, "down");
    const withoutZodiac = buildWeights(star, null, "down");
    for (const n of aries.luckyNumbers) {
      expect(withoutZodiac[n]).toBeLessThan(withZodiac[n]);
    }
  });
});

describe("weightedSampleWithoutReplacement", () => {
  it("picks the requested count of unique numbers", () => {
    const weights = new Array(46).fill(0);
    for (let n = 1; n <= 45; n++) weights[n] = 1;

    const picked = weightedSampleWithoutReplacement(weights, 6);

    expect(picked).toHaveLength(6);
    expect(new Set(picked).size).toBe(6);
    for (const n of picked) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(45);
    }
  });

  it("never picks a number with zero weight", () => {
    const weights = new Array(46).fill(0);
    weights[1] = 1;
    weights[2] = 1;
    weights[3] = 1;

    const picked = weightedSampleWithoutReplacement(weights, 3);

    expect(new Set(picked)).toEqual(new Set([1, 2, 3]));
  });
});

describe("generateTarotNumberSets", () => {
  it("produces the requested number of independent 6-number sets", () => {
    const sets = generateTarotNumberSets(star, aries, "up", 3);
    expect(sets).toHaveLength(3);
    for (const numbers of sets) {
      expect(numbers).toHaveLength(6);
      expect(new Set(numbers).size).toBe(6);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
    }
  });

  it("returns exactly one set when count is 1", () => {
    const sets = generateTarotNumberSets(star, null, "down", 1);
    expect(sets).toHaveLength(1);
  });
});
