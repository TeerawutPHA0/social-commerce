import { describe, it, expect } from "vitest";
import { isRealImage, validateSlip, SLIP_MAX_BYTES } from "@/lib/slip";

/** สร้าง File จาก magic-byte prefix + padding ให้ยาวพอ (>=16 ไบต์) */
function fileFrom(bytes: number[], type = "image/jpeg"): File {
  const buf = Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);
  return new File([buf], "slip", { type });
}

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];

describe("isRealImage (magic bytes)", () => {
  it("รับ JPEG / PNG จริง", async () => {
    expect(await isRealImage(fileFrom(JPEG))).toBe(true);
    expect(await isRealImage(fileFrom(PNG))).toBe(true);
  });

  it("รับ WebP (RIFF....WEBP)", async () => {
    const riff = Buffer.from("RIFF");
    const webp = Buffer.from("WEBP");
    const buf = Buffer.concat([riff, Buffer.alloc(4), webp, Buffer.alloc(8)]);
    expect(await isRealImage(new File([buf], "s", { type: "image/webp" }))).toBe(true);
  });

  it("รับ HEIC (ftyp ที่ offset 4)", async () => {
    const buf = Buffer.concat([Buffer.alloc(4), Buffer.from("ftyp"), Buffer.alloc(8)]);
    expect(await isRealImage(new File([buf], "s", { type: "image/heic" }))).toBe(true);
  });

  it("ปฏิเสธไฟล์ปลอม (เนื้อไม่ใช่รูป แม้ตั้ง type เป็น image)", async () => {
    expect(await isRealImage(fileFrom([0x25, 0x50, 0x44, 0x46]))).toBe(false); // %PDF
  });

  it("ปฏิเสธไฟล์สั้นเกินไป (< 12 ไบต์)", async () => {
    expect(await isRealImage(new File([Buffer.from([0xff, 0xd8])], "s"))).toBe(false);
  });
});

describe("validateSlip", () => {
  it("ผ่านเมื่อเป็นรูปและไม่เกินขนาด", () => {
    expect(validateSlip(fileFrom(JPEG)).ok).toBe(true);
  });

  it("ปฏิเสธไฟล์ว่าง/ไม่มีไฟล์", () => {
    expect(validateSlip(null).ok).toBe(false);
    expect(validateSlip(new File([], "s", { type: "image/jpeg" })).ok).toBe(false);
  });

  it("ปฏิเสธไฟล์ใหญ่เกิน 5MB", () => {
    const big = new File([Buffer.alloc(SLIP_MAX_BYTES + 1)], "s", { type: "image/jpeg" });
    expect(validateSlip(big).ok).toBe(false);
  });

  it("ปฏิเสธชนิดที่ไม่ใช่รูป (เช่น application/pdf)", () => {
    const pdf = new File([Buffer.alloc(100)], "s", { type: "application/pdf" });
    expect(validateSlip(pdf).ok).toBe(false);
  });
});
