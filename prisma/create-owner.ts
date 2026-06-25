import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

/**
 * สร้าง/อัปเดต owner user ของร้านเริ่มต้น จาก ADMIN_EMAIL + ADMIN_PASSWORD
 * ใช้ bootstrap login ฝั่ง prod (Phase 2 เปลี่ยนจากรหัสเดียว → บัญชีผู้ใช้)
 *
 * idempotent — รันซ้ำได้ (อัปเดตรหัสให้ตรง env):
 *   ADMIN_EMAIL="me@example.com" ADMIN_PASSWORD="..." npx tsx prisma/create-owner.ts
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    throw new Error("ต้องตั้ง ADMIN_EMAIL และ ADMIN_PASSWORD ใน env ก่อน");
  }

  const slug = process.env.DEFAULT_STORE_SLUG ?? "puffiepiece";
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) throw new Error(`ไม่พบร้าน slug="${slug}" — รัน migration/seed ก่อน`);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, storeId: store.id, role: "owner" },
    create: { email, passwordHash, storeId: store.id, role: "owner" },
  });
  console.log(`✅ owner user "${user.email}" → store "${slug}"`);
}

main()
  .catch((e) => {
    console.error("\n❌ create-owner ล้มเหลว:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
