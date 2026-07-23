import { describe, expect, it } from "vitest";
import { detectDragDirection } from "./dragDirection";

describe("detectDragDirection", () => {
  it("returns null when the drag is shorter than the threshold", () => {
    expect(detectDragDirection(5, 5)).toBeNull();
    expect(detectDragDirection(0, 0)).toBeNull();
  });

  it("detects a rightward drag", () => {
    expect(detectDragDirection(50, 5)).toBe("right");
  });

  it("detects a leftward drag", () => {
    expect(detectDragDirection(-50, 5)).toBe("left");
  });

  it("detects a downward drag", () => {
    expect(detectDragDirection(5, 50)).toBe("down");
  });

  it("detects an upward drag", () => {
    expect(detectDragDirection(5, -50)).toBe("up");
  });

  it("picks the dominant axis when both exceed the threshold", () => {
    expect(detectDragDirection(60, 40)).toBe("right");
    expect(detectDragDirection(40, 60)).toBe("down");
  });

  it("respects a custom threshold", () => {
    expect(detectDragDirection(15, 0, 10)).toBe("right");
    expect(detectDragDirection(5, 0, 10)).toBeNull();
  });
});
