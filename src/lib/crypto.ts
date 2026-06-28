import "server-only";
import crypto from "node:crypto";

/* เข้ารหัสความลับที่เก็บใน DB (LINE token/secret ฯลฯ) ด้วย AES-256-GCM
   - คีย์ derive จาก SESSION_SECRET (scrypt) → ไม่ต้องตั้ง env เพิ่ม
   - รูปแบบ ciphertext: "v1:" + base64(iv[12] | authTag[16] | ciphertext)
   ⚠️ ถ้าเปลี่ยน SESSION_SECRET ค่าที่เข้ารหัสไว้เดิมจะถอดไม่ได้ (ต้องตั้งค่าใหม่) */

let cachedKey: { secret: string; key: Buffer } | null = null;

function key(): Buffer {
  const secret = process.env.SESSION_SECRET
    ? process.env.SESSION_SECRET
    : process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("SESSION_SECRET ยังไม่ได้ตั้งค่า — ต้องตั้งก่อนใช้การเข้ารหัส");
        })()
      : "dev-insecure-secret-change-me";

  if (cachedKey?.secret === secret) return cachedKey.key;
  const derived = crypto.scryptSync(secret, "social-commerce/enc/v1", 32);
  cachedKey = { secret, key: derived };
  return derived;
}

/** เข้ารหัส plaintext → string เก็บลง DB ได้ */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1:" + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** ถอดรหัสค่าที่ได้จาก encrypt() — throw ถ้าค่าเสีย/คีย์ไม่ตรง */
export function decrypt(enc: string): string {
  if (!enc.startsWith("v1:")) throw new Error("รูปแบบ ciphertext ไม่ถูกต้อง");
  const raw = Buffer.from(enc.slice(3), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
