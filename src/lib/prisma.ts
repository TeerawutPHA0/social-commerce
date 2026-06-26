import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client singleton (Prisma 7 — ใช้ driver adapter pg สำหรับ Postgres/Neon)
 * กัน hot-reload ของ Next dev สร้าง connection ซ้ำจนเกิน limit
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * ตัด `sslmode` ออกจาก connection string แล้วตั้ง ssl ตรง ๆ แทน
 * เพื่อเลี่ยง deprecation warning ของ pg-connection-string (sslmode=require/prefer/verify-ca)
 * — คงพฤติกรรมเดิม (verify-full = ตรวจ cert ของ Neon) ไม่ลดความปลอดภัย
 */
function pgConfig() {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const url = new URL(raw);
    const sslmode = url.searchParams.get("sslmode");
    url.searchParams.delete("sslmode");
    const ssl =
      sslmode && sslmode !== "disable" ? { rejectUnauthorized: true } : undefined;
    return { connectionString: url.toString(), ssl };
  } catch {
    return { connectionString: raw };
  }
}

function createClient() {
  const adapter = new PrismaPg(pgConfig());
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
