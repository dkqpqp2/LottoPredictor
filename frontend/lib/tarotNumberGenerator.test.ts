import { describe, expect, it } from "vitest";
import {
  buildWeights,
  buildWeightsForPicks,
  cardSeedNumber,
  generateTarotNumbers,
  generateTarotNumbersForPicks,
  weightedSampleWithoutReplacement,
} from "./tarotNumberGenerator";
import { TAROT_CARDS } from "./tarotCards";
import { ZODIAC_SIGNS } from "./zodiac";

const star = TAROT_CARDS.find((c) => c.nameEn === "The Star")!; // number 17
const fool = TAROT_CARDS.find((c) => c.nameEn === "The Fool")!; // number 0
const magician = TAROT_CARDS.find((c) => c.nameEn === "The Magician")!; // number 1
const world = TAROT_CARDS.find((c) => c.nameEn === "The World")!; // number 21
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

describe("generateTarotNumbers", () => {
  it("produces 6 unique sorted numbers within 1-45 across many runs", () => {
    for (let i = 0; i < 50; i++) {
      const numbers = generateTarotNumbers(star, aries, "up");
      expect(numbers).toHaveLength(6);
      expect(new Set(numbers).size).toBe(6);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
    }
  });

  it("still works with no zodiac (birthdate optional)", () => {
    for (let i = 0; i < 50; i++) {
      const numbers = generateTarotNumbers(star, null, "up");
      expect(numbers).toHaveLength(6);
      expect(new Set(numbers).size).toBe(6);
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
    }
  });
});

describe("buildWeightsForPicks", () => {
  it("combines the seed-number boost from every pick in the spread", () => {
    const picks = [
      { card: fool, direction: "down" as const }, // seed 22 -> 22, 44
      { card: magician, direction: "down" as const }, // seed 1 -> 1, 23
      { card: world, direction: "down" as const }, // seed 21 -> 21, 43
    ];
    const weights = buildWeightsForPicks(picks, null);

    for (const n of [22, 44, 1, 23, 21, 43]) {
      expect(weights[n]).toBeGreaterThanOrEqual(1 + 8);
    }
  });

  it("matches single-card buildWeights when given exactly one pick", () => {
    const single = buildWeights(star, aries, "up");
    const spread = buildWeightsForPicks([{ card: star, direction: "up" }], aries);
    expect(spread).toEqual(single);
  });
});

describe("generateTarotNumbersForPicks", () => {
  it("produces 6 unique sorted numbers within 1-45 across many runs", () => {
    const picks = [
      { card: fool, direction: "up" as const },
      { card: magician, direction: "down" as const },
      { card: world, direction: "left" as const },
    ];
    for (let i = 0; i < 50; i++) {
      const numbers = generateTarotNumbersForPicks(picks, null);
      expect(numbers).toHaveLength(6);
      expect(new Set(numbers).size).toBe(6);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
    }
  });
});
