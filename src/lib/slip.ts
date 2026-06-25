import "server-only";
import { put, del } from "@vercel/blob";

/** ขนาดไฟล์สลิปสูงสุดที่รับ (5MB) */
export const SLIP_MAX_BYTES = 5 * 1024 * 1024;
/** ชนิดไฟล์ที่อนุญาต */
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export type SlipValidation = { ok: true; file: File } | { ok: false; error: string };

/** ตรวจไฟล์สลิปก่อนอัพ — ต้องเป็นรูปภาพ + ไม่เกินขนาดที่กำหนด */
export function validateSlip(file: File | null): SlipValidation {
  if (!file || file.size === 0) return { ok: false, error: "ไม่พบไฟล์สลิป" };
  if (file.size > SLIP_MAX_BYTES) {
    return { ok: false, error: "ไฟล์ใหญ่เกินไป (สูงสุด 5MB)" };
  }
  const type = file.type || "";
  if (!type.startsWith("image/") || (ALLOWED_MIME.length > 0 && !ALLOWED_MIME.includes(type))) {
    return { ok: false, error: "รองรับเฉพาะไฟล์รูปภาพ (JPG/PNG/WebP)" };
  }
  return { ok: true, file };
}

/**
 * อัพรูปสลิปขึ้น Vercel Blob → คืน public URL
 * pathname ใช้ token เป็น prefix เพื่อให้ลบ/อ้างอิงต่อร้าน/ออเดอร์ได้ง่าย
 * (Vercel Blob เติม suffix สุ่มให้เอง จึงเดา URL ของออเดอร์อื่นไม่ได้)
 */
export async function uploadSlipBlob(token: string, file: File): Promise<string> {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`slips/${token}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type || "image/jpeg",
  });
  return blob.url;
}

/** ลบรูปสลิปเก่าออกจาก Blob (ใช้ตอน reject/อัพใหม่) — เงียบถ้าลบไม่ได้ */
export async function deleteSlipBlob(url: string | null | undefined): Promise<void> {
  if (!url) return;
  await del(url).catch(() => {});
}
