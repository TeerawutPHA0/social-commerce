import "server-only";
import { put, del } from "@vercel/blob";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/* อัพ/ลบรูปสินค้า — โครงเดียวกับสลิป (lib/slip.ts): มี Blob token → Vercel Blob,
   ไม่มี (local dev / e2e) → เขียนลง public/uploads/products */

const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const id = crypto.randomBytes(6).toString("hex");

  if (!blobConfigured()) {
    const name = `product-${id}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "products");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return `/uploads/products/${name}`;
  }

  const blob = await put(`products/${id}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type || "image/jpeg",
  });
  return blob.url;
}

export async function deleteProductImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  if (url.startsWith("/uploads/")) {
    await unlink(path.join(process.cwd(), "public", url)).catch(() => {});
    return;
  }
  await del(url).catch(() => {});
}
