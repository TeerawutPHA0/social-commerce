import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

/* ระบบ auth multi-tenant: บัญชีผู้ใช้ (email + scrypt hash) + signed cookie session
   - session cookie เซ็นด้วย HMAC(SESSION_SECRET) + มี exp ปลอมไม่ได้
   - payload เก็บ userId + storeId + role → ใช้ scope ข้อมูลต่อร้าน
   - password hashing อยู่ที่ lib/password.ts (ใช้ร่วมกับ script ฝั่ง prisma ได้) */

// re-export เพื่อให้ที่เดิม import { verifyPassword } from "@/lib/auth" ยังใช้ได้
export { hashPassword, verifyPassword } from "@/lib/password";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 วัน (วินาที)

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // production: ห้ามใช้ค่า fallback ที่เดาได้ (ไม่งั้น session ปลอมได้) — บังคับให้ตั้ง env
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET ยังไม่ได้ตั้งค่า — ต้องตั้งใน env ก่อน deploy (สุ่ม เช่น `openssl rand -hex 32`)"
    );
  }
  return "dev-insecure-secret-change-me";
}

/* ===================== Signed session cookie (stateless) ===================== */

type SessionPayload = { uid: string; sid: string; role: string; exp: number };

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

function encodeSession(p: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!p.uid || !p.sid || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

/** ออก session cookie หลัง login สำเร็จ */
export async function startSession(user: {
  id: string;
  storeId: string;
  role: string;
}): Promise<void> {
  const store = await cookies();
  store.set(
    COOKIE,
    encodeSession({
      uid: user.id,
      sid: user.storeId,
      role: user.role,
      exp: Date.now() + MAX_AGE * 1000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    }
  );
}

/** ลบ session (logout) */
export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/* ===================== Data Access Layer (DAL) ===================== */

export type Session = { userId: string; storeId: string; role: string };

/** อ่าน session ปัจจุบัน (memoize ต่อ render ด้วย React cache) — null ถ้าไม่ได้ login */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const p = decodeSession(store.get(COOKIE)?.value);
  return p ? { userId: p.uid, storeId: p.sid, role: p.role } : null;
});

/** บังคับต้อง login — ถ้าไม่ → เด้งไปหน้า login (ใช้ในหน้า/แอ็กชัน admin) */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}

/** บังคับต้องเป็น owner — staff จะถูกเด้งกลับ /admin (ใช้กับหน้า/แอ็กชัน owner-only เช่น ตั้งค่า/จัดการผู้ใช้) */
export async function requireOwner(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "owner") redirect("/admin");
  return s;
}

/* ===================== Login rate limit (best-effort) =====================
   เก็บใน memory ของ instance — กัน brute force ได้ระดับหนึ่ง
   หมายเหตุ: serverless มีหลาย instance/cold start → ของจริงควรย้ายไป Redis/DB */

const WINDOW_MS = 15 * 60 * 1000; // 15 นาที
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

/** IP ของผู้เรียก (สำหรับ rate limit) */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export function checkRateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) return { ok: true };
  if (rec.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { ok: true };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else rec.count += 1;
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}
