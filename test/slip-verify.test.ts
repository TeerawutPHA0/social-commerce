import { describe, it, expect } from "vitest";
import { matchAmount } from "@/lib/slip-verify/match";

describe("matchAmount (เทียบยอดสลิป)", () => {
  it("ตรงเป๊ะ → true", () => {
    expect(matchAmount(270, 270)).toBe(true);
  });

  it("ต่างกันเกิน 1 สตางค์ → false", () => {
    expect(matchAmount(200, 270)).toBe(false);
    expect(matchAmount(270.5, 270)).toBe(false);
  });

  it("ต่างกันในระดับปัดเศษ (< 1 สตางค์) → true", () => {
    expect(matchAmount(270.001, 270)).toBe(true);
    expect(matchAmount(269.999, 270)).toBe(true);
  });

  it("อ่านยอดในสลิปไม่ได้ (undefined/NaN) → null (ตัดสินไม่ได้)", () => {
    expect(matchAmount(undefined, 270)).toBeNull();
    expect(matchAmount(NaN, 270)).toBeNull();
  });
});
