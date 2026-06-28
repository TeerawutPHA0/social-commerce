import "server-only";

/* Rate-limit login (Phase 12) — pluggable:
   - ตั้ง UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → ใช้ Redis (แชร์ข้าม instance บน serverless)
   - ไม่ตั้ง → fallback in-memory (dev / เครื่องเดียว)
   ใช้ REST API ของ Upstash ตรง ๆ (ไม่ต้องลง dependency เพิ่ม) */

const WINDOW_MS = 15 * 60 * 1000;
const WINDOW_SEC = 15 * 60;
const MAX_ATTEMPTS = 8;

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = () => Boolean(REDIS_URL && REDIS_TOKEN);

// in-memory fallback (ไม่เสถียรข้าม instance — แค่กันระดับนึง)
const mem = new Map<string, { count: number; resetAt: number }>();

const keyOf = (ip: string) => `rl:login:${ip}`;

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return (await res.json()).result;
}

export async function checkRateLimit(ip: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  if (useRedis()) {
    try {
      const count = Number(await redis(["GET", keyOf(ip)])) || 0;
      if (count >= MAX_ATTEMPTS) {
        const ttl = Number(await redis(["TTL", keyOf(ip)])) || WINDOW_SEC;
        return { ok: false, retryAfterSec: Math.max(1, ttl) };
      }
      return { ok: true };
    } catch {
      return { ok: true }; // Redis ล่ม → fail-open (ไม่ล็อกผู้ใช้จริงออก)
    }
  }
  const now = Date.now();
  const rec = mem.get(ip);
  if (!rec || rec.resetAt < now) return { ok: true };
  if (rec.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { ok: true };
}

export async function recordFailedAttempt(ip: string): Promise<void> {
  if (useRedis()) {
    try {
      const n = Number(await redis(["INCR", keyOf(ip)]));
      if (n === 1) await redis(["EXPIRE", keyOf(ip), WINDOW_SEC]);
    } catch {
      /* บันทึกไม่ได้ ก็ปล่อยผ่าน */
    }
    return;
  }
  const now = Date.now();
  const rec = mem.get(ip);
  if (!rec || rec.resetAt < now) mem.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else rec.count += 1;
}

export async function clearAttempts(ip: string): Promise<void> {
  if (useRedis()) {
    try {
      await redis(["DEL", keyOf(ip)]);
    } catch {
      /* ignore */
    }
    return;
  }
  mem.delete(ip);
}
