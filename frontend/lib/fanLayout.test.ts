import { describe, expect, it } from "vitest";
import { computeFanTransform } from "./fanLayout";

describe("computeFanTransform", () => {
  it("returns no offset when there is only one card", () => {
    expect(computeFanTransform(0, 1, 480)).toEqual({ x: 0, y: 0, rotate: 0 });
  });

  it("places the middle card of an odd-sized fan dead center", () => {
    const middle = computeFanTransform(1, 3, 480);
    expect(middle.x).toBeCloseTo(0);
    expect(middle.y).toBeCloseTo(0);
    expect(middle.rotate).toBeCloseTo(0);
  });

  it("mirrors the leftmost and rightmost card horizontally and by rotation", () => {
    const left = computeFanTransform(0, 5, 480);
    const right = computeFanTransform(4, 5, 480);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.rotate).toBeCloseTo(-right.rotate);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
  });

  it("droops cards further from center lower than the center card", () => {
    const center = computeFanTransform(2, 5, 480);
    const edge = computeFanTransform(0, 5, 480);
    expect(edge.y).toBeGreaterThan(center.y);
  });

  it("shrinks the spread on a narrower container", () => {
    const wide = computeFanTransform(0, 5, 480);
    const narrow = computeFanTransform(0, 5, 260);
    expect(Math.abs(narrow.x)).toBeLessThan(Math.abs(wide.x));
  });

  it("clamps container width below the minimum to the same result as the minimum", () => {
    const atMin = computeFanTransform(0, 5, 260);
    const belowMin = computeFanTransform(0, 5, 100);
    expect(belowMin).toEqual(atMin);
  });

  it("clamps container width above the reference to the same result as the reference", () => {
    const atRef = computeFanTransform(0, 5, 480);
    const aboveRef = computeFanTransform(0, 5, 900);
    expect(aboveRef).toEqual(atRef);
  });
});
