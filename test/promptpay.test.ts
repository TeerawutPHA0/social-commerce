import { describe, it, expect } from "vitest";
import {
  normalizePromptpayId,
  isValidPromptpayId,
  promptpayQrDataUrl,
} from "@/lib/promptpay";

describe("normalizePromptpayId", () => {
  it("เก็บเฉพาะตัวเลข", () => {
    expect(normalizePromptpayId("081-234-5678")).toBe("0812345678");
    expect(normalizePromptpayId(" 1-234 567890123 ")).toBe("1234567890123");
  });
});

describe("isValidPromptpayId", () => {
  it("ยอมรับ 10 / 13 / 15 หลัก", () => {
    expect(isValidPromptpayId("0812345678")).toBe(true); // เบอร์
    expect(isValidPromptpayId("1234567890123")).toBe(true); // บัตร ปชช.
    expect(isValidPromptpayId("123456789012345")).toBe(true); // e-wallet
  });

  it("ปฏิเสธความยาวอื่น", () => {
    expect(isValidPromptpayId("0812")).toBe(false);
    expect(isValidPromptpayId("12345678901")).toBe(false); // 11
    expect(isValidPromptpayId("")).toBe(false);
  });
});

describe("promptpayQrDataUrl", () => {
  it("คืน data URL (PNG) เมื่อเลข+ยอดถูกต้อง", async () => {
    const url = await promptpayQrDataUrl("0812345678", 270);
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it("คืน null เมื่อเลขไม่ถูกต้อง หรือยอด <= 0", async () => {
    expect(await promptpayQrDataUrl("0812", 270)).toBeNull();
    expect(await promptpayQrDataUrl("0812345678", 0)).toBeNull();
    expect(await promptpayQrDataUrl("0812345678", -5)).toBeNull();
  });
});
