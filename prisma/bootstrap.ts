import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

/**
 * Bootstrap ร้านใหม่ 1 ราย — โมเดล 1: 1 deployment = 1 ร้าน
 * สร้าง Store เปล่า + owner ในคำสั่งเดียว (ไม่มีข้อมูล demo)
 *
 * ใช้ (ตั้งใน .env หรือ inline):
 *   STORE_NAME="ร้านของลูกค้า" ADMIN_EMAIL="owner@x.com" ADMIN_PASSWORD="รหัสยาวๆ" npm run bootstrap
 *
 * env เสริม:
 *   STORE_SLUG  — slug ภายใน (ดีฟอลต์: แปลงจาก STORE_NAME, ถ้าเป็นไทยล้วนจะใช้ "store")
 *   STORE_LOGO  — path/URL โลโก้ (ดีฟอลต์ "/logo.jpg" — เปลี่ยนได้ภายหลังที่ /admin/settings)
 *
 * idempotent — รันซ้ำได้ (อัปเดตชื่อร้าน + รหัส owner ให้ตรง env)
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** แปลงชื่อ → slug (a-z0-9 + ขีด) — คืน "" ถ้าไม่มีตัวอักษรละติน (เช่นชื่อไทยล้วน) */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const name = (process.env.STORE_NAME ?? "").trim();
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (!name) throw new Error("ต้องตั้ง STORE_NAME (ชื่อร้านที่จะแสดง)");
  if (!email || !password) {
    throw new Error("ต้องตั้ง ADMIN_EMAIL และ ADMIN_PASSWORD (บัญชี owner สำหรับ login)");
  }

  const slug = process.env.STORE_SLUG?.trim() || slugify(name) || "store";
  const logo = process.env.STORE_LOGO?.trim() || "/logo.jpg";

  // สร้าง/อัปเดตร้าน (ตาม slug) — ไม่แตะข้อมูลรับเงิน/ออเดอร์ที่มีอยู่
  const store = await prisma.store.upsert({
    where: { slug },
    update: { name, logo },
    create: { slug, name, logo },
  });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, storeId: store.id, role: "owner" },
    create: { email, passwordHash, storeId: store.id, role: "owner" },
  });

  console.log("✅ bootstrap เสร็จแล้ว");
  console.log(`   ร้าน  : "${store.name}" (slug=${store.slug})`);
  console.log(`   owner : ${user.email}`);
  console.log("   ถัดไป : login ที่ /admin แล้วตั้งค่าโลโก้/บัญชีรับเงินที่ /admin/settings");
}

main()
  .catch((e) => {
    console.error("\n❌ bootstrap ล้มเหลว:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
