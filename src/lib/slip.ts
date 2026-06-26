import "server-only";
import { put, del } from "@vercel/blob";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/** มี Vercel Blob ให้ใช้ไหม — ไม่มี token (local dev / e2e test) → fallback เขียนลง disk */
const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

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

  // local dev / e2e: ไม่มี Blob token → เขียนไฟล์ลง public/uploads/slips แล้วเสิร์ฟผ่าน path สาธารณะ
  // (เติม suffix สุ่มเองให้สอดคล้องกับพฤติกรรม addRandomSuffix ของ Blob — เดา URL ออเดอร์อื่นไม่ได้)
  if (!blobConfigured()) {
    const suffix = crypto.randomBytes(4).toString("hex");
    const name = `${token}-${suffix}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "slips");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return `/uploads/slips/${name}`;
  }

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
  // ไฟล์ local (จาก fallback) ขึ้นต้นด้วย /uploads/ → ลบออกจาก disk; ไม่งั้นลบจาก Vercel Blob
  if (url.startsWith("/uploads/")) {
    await unlink(path.join(process.cwd(), "public", url)).catch(() => {});
    return;
  }
  await del(url).catch(() => {});
}
