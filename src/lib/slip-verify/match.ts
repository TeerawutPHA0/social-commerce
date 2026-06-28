/* ตรรกะเทียบยอด (pure, ไม่พึ่ง provider/DB/format) — แยกออกมาให้เทสได้ตรง ๆ */

/**
 * ยอดในสลิปตรงกับที่ต้องชำระไหม
 * - null  = ไม่ทราบยอดในสลิป (provider อ่านยอดไม่ได้) → ตัดสินไม่ได้
 * - true  = ตรง (เผื่อ error ปัดเศษ < 1 สตางค์)
 * - false = ไม่ตรง
 */
export function matchAmount(slipAmount: number | undefined, expected: number): boolean | null {
  if (typeof slipAmount !== "number" || !Number.isFinite(slipAmount)) return null;
  return Math.abs(slipAmount - expected) < 0.01;
}
