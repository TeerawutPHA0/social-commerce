import { describe, it, expect } from "vitest";
import { checkRateLimit, recordFailedAttempt, clearAttempts } from "@/lib/ratelimit";

/* ไม่มี UPSTASH_* env → ใช้ in-memory · MAX_ATTEMPTS = 8, window 15 นาที
   ใช้ IP ไม่ซ้ำกันต่อเทส เพื่อไม่ให้ state (Map ระดับโมดูล) ปนกัน */

describe("rate limit (in-memory)", () => {
  it("IP ใหม่ผ่านได้", async () => {
    expect((await checkRateLimit("ip-fresh")).ok).toBe(true);
  });

  it("บล็อกเมื่อพยายามครบ 8 ครั้ง", async () => {
    const ip = "ip-brute";
    for (let i = 0; i < 7; i++) await recordFailedAttempt(ip);
    expect((await checkRateLimit(ip)).ok).toBe(true); // ครั้งที่ 8 ยังเข้าได้

    await recordFailedAttempt(ip); // ครบ 8
    const res = await checkRateLimit(ip);
    expect(res.ok).toBe(false);
    expect(res.retryAfterSec).toBeGreaterThan(0);
  });

  it("clearAttempts ปลดล็อก (หลัง login สำเร็จ)", async () => {
    const ip = "ip-clear";
    for (let i = 0; i < 8; i++) await recordFailedAttempt(ip);
    expect((await checkRateLimit(ip)).ok).toBe(false);

    await clearAttempts(ip);
    expect((await checkRateLimit(ip)).ok).toBe(true);
  });
});
