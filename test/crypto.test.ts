import { describe, it, expect, beforeAll } from "vitest";

// ต้องตั้งก่อน import โมดูล (key() อ่าน env ตอนเรียกใช้ — ตั้งไว้ก่อนเรียกครั้งแรกพอ)
beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
});

import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto (AES-256-GCM)", () => {
  it("เข้ารหัสแล้วถอดได้ค่าเดิม (roundtrip)", () => {
    const plain = "LINE-channel-token-ทดสอบ-🔐";
    const enc = encrypt(plain);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it("ciphertext ต่างกันทุกครั้ง (IV สุ่ม) แต่ถอดได้ค่าเดิม", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  it("ถอดค่าที่ถูกแก้ไข (tamper) ต้อง throw — auth tag ไม่ผ่าน", () => {
    const enc = encrypt("secret");
    const raw = Buffer.from(enc.slice(3), "base64");
    raw[raw.length - 1] ^= 0xff; // พลิกบิตท้าย (ciphertext)
    const tampered = "v1:" + raw.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("รูปแบบไม่ขึ้นต้น v1: ต้อง throw", () => {
    expect(() => decrypt("plain-text")).toThrow();
  });
});
