import { describe, expect, it } from "vitest";
import { getZodiacSign } from "./zodiac";

describe("getZodiacSign", () => {
  it("classifies a date in the middle of a sign's range", () => {
    expect(getZodiacSign(new Date(2000, 6, 1)).id).toBe("cancer"); // Jul 1
  });

  it("classifies the day before a sign boundary as the earlier sign", () => {
    expect(getZodiacSign(new Date(2000, 11, 21)).id).toBe("sagittarius"); // Dec 21
  });

  it("classifies the day of a sign boundary as the later sign", () => {
    expect(getZodiacSign(new Date(2000, 11, 22)).id).toBe("capricorn"); // Dec 22
  });

  it("handles the Capricorn wraparound across the year boundary", () => {
    expect(getZodiacSign(new Date(2001, 0, 1)).id).toBe("capricorn"); // Jan 1
    expect(getZodiacSign(new Date(2001, 0, 19)).id).toBe("capricorn"); // Jan 19
    expect(getZodiacSign(new Date(2001, 0, 20)).id).toBe("aquarius"); // Jan 20
  });

  it("classifies the first and last day of a normal (non-wrapping) sign", () => {
    expect(getZodiacSign(new Date(2000, 2, 21)).id).toBe("aries"); // Mar 21
    expect(getZodiacSign(new Date(2000, 3, 19)).id).toBe("aries"); // Apr 19
  });
});
