import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

/* ระบบ auth แบบรหัสผ่านเดียว (เก็บใน .env) + signed cookie session
   - ตรวจรหัสกับ ADMIN_PASSWORD
   - cookie เซ็นด้วย HMAC(SESSION_SECRET) + มีวันหมดอายุ ปลอมไม่ได้ */

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 วัน (วินาที)

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

/** สร้าง token: "<expMs>.<hmac>" */
function makeToken(): string {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${exp}.${sign(exp)}`;
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** ตรวจรหัสผ่านกับค่าใน .env */
export function checkPassword(pw: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  return expected.length > 0 && pw === expected;
}

/** ออก session cookie หลัง login สำเร็จ */
export async function startSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** ลบ session (logout) */
export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** เช็คว่า login อยู่ไหม (ใช้ใน layout ป้องกันหน้า admin) */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return isValidToken(store.get(COOKIE)?.value);
}
