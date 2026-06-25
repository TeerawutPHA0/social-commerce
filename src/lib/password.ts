import crypto from "node:crypto";
import { promisify } from "node:util";

/* Password hashing ด้วย scrypt (มากับ node — ไม่ต้องลง native dep)
   แยกจาก lib/auth.ts (ที่เป็น server-only + ใช้ next/headers) เพื่อให้ script ฝั่ง
   prisma (seed/create-owner) import มาใช้ได้โดยไม่ดึง next runtime เข้ามา */

const scrypt = promisify(crypto.scrypt) as (
  pw: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number
) => Promise<Buffer>;

/** สร้าง hash เก็บลง DB — รูปแบบ "scrypt$<saltHex>$<keyHex>" */
export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** ตรวจรหัสกับ hash ที่เก็บไว้ (timing-safe) */
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const key = Buffer.from(keyHex, "hex");
  const test = await scrypt(pw, Buffer.from(saltHex, "hex"), key.length);
  return key.length === test.length && crypto.timingSafeEqual(key, test);
}
