import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * One-time migration: single-store → multi-tenant (Phase 1)
 *
 * ทำไมต้องมีสคริปต์นี้ (แทน `prisma db push` ตรง ๆ):
 *   storeId เป็น NOT NULL — ถ้าตาราง Order/Product มีข้อมูลเดิมอยู่ การ push
 *   จะ error เพราะเติมคอลัมน์ที่ห้าม null ไม่ได้ สคริปต์นี้จึง:
 *     1) สร้างตาราง Store / User (ถ้ายังไม่มี)
 *     2) เติม storeId แบบ nullable ก่อน + ลบคอลัมน์ไบต์สลิปเก่า
 *     3) สร้างร้านเริ่มต้น "puffiepiece" แล้ว backfill storeId ของทุกแถวเดิม
 *     4) บังคับ NOT NULL + FK + unique(storeId, orderNo) ให้ตรง schema
 *
 * รันด้วย DIRECT connection (ไม่ใช่ pooled/PgBouncer — DDL จะค้าง):
 *   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" npx tsx prisma/migrate-to-multitenant.ts
 *
 * idempotent — รันซ้ำได้ปลอดภัย หลังรันเสร็จ `prisma db push` ควรขึ้น "already in sync"
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ค่าร้านเริ่มต้น (ตรงกับ src/lib/payment.ts เดิม) — Phase 3 จะย้ายมาแก้ผ่าน UI
const DEFAULT_STORE = {
  slug: "puffiepiece",
  name: "puffiepiece",
  logo: "/logo.jpg",
  payAccountName: "ณัฐวิภา ชะลาลัย",
  payMethods: [
    { label: "kbank (กสิกร)", value: "069-2-94362-7" },
    { label: "true wallet", value: "095-886-5714", note: "ไม่มีพร้อมเพย์นะคะ" },
  ],
  payQrImage: "/qrcode.jpg",
  payWarning: "รบกวนเช็คเลขก่อนโอนนะคะ",
  defaultShippingFee: 0,
};

async function exec(label: string, sql: string) {
  await prisma.$executeRawUnsafe(sql);
  console.log("  ✓", label);
}

async function main() {
  console.log("→ 1/4 สร้างตาราง Store / User");
  await exec(
    "Store table",
    `CREATE TABLE IF NOT EXISTS "Store" (
       "id" TEXT NOT NULL,
       "slug" TEXT NOT NULL,
       "name" TEXT NOT NULL,
       "logo" TEXT NOT NULL DEFAULT '/logo.jpg',
       "payAccountName" TEXT NOT NULL DEFAULT '',
       "payMethods" JSONB NOT NULL DEFAULT '[]',
       "payQrImage" TEXT,
       "payWarning" TEXT,
       "defaultShippingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
       "courierConfig" JSONB,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
     )`
  );
  await exec("Store_slug_key", `CREATE UNIQUE INDEX IF NOT EXISTS "Store_slug_key" ON "Store"("slug")`);
  await exec(
    "User table",
    `CREATE TABLE IF NOT EXISTS "User" (
       "id" TEXT NOT NULL,
       "email" TEXT NOT NULL,
       "passwordHash" TEXT NOT NULL,
       "role" TEXT NOT NULL DEFAULT 'owner',
       "storeId" TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "User_pkey" PRIMARY KEY ("id")
     )`
  );
  await exec("User_email_key", `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`);
  await exec("User_storeId_idx", `CREATE INDEX IF NOT EXISTS "User_storeId_idx" ON "User"("storeId")`);

  console.log("→ 2/4 เพิ่ม storeId (nullable) + ลบคอลัมน์ไบต์สลิปเก่า");
  await exec("Order.storeId", `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "storeId" TEXT`);
  await exec("Order.storeName", `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "storeName" TEXT`);
  await exec(
    "Order.storeLogo",
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "storeLogo" TEXT NOT NULL DEFAULT '/logo.jpg'`
  );
  await exec("drop paymentSlipData", `ALTER TABLE "Order" DROP COLUMN IF EXISTS "paymentSlipData"`);
  await exec("drop paymentSlipMime", `ALTER TABLE "Order" DROP COLUMN IF EXISTS "paymentSlipMime"`);
  await exec("Product.storeId", `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "storeId" TEXT`);

  console.log("→ 3/4 สร้างร้านเริ่มต้น + backfill storeId แถวเดิม");
  const store = await prisma.store.upsert({
    where: { slug: DEFAULT_STORE.slug },
    update: {},
    create: DEFAULT_STORE,
  });
  console.log(`  ✓ store "${store.slug}" (${store.id})`);
  const o = await prisma.$executeRawUnsafe(
    `UPDATE "Order" SET "storeId" = $1 WHERE "storeId" IS NULL`,
    store.id
  );
  const onames = await prisma.$executeRawUnsafe(
    `UPDATE "Order" SET "storeName" = $1 WHERE "storeName" IS NULL OR "storeName" = ''`,
    store.name
  );
  const p = await prisma.$executeRawUnsafe(
    `UPDATE "Product" SET "storeId" = $1 WHERE "storeId" IS NULL`,
    store.id
  );
  console.log(`  ✓ backfilled ${o} orders (${onames} names), ${p} products`);

  console.log("→ 4/4 บังคับ NOT NULL + FK + unique/index ให้ตรง schema");
  await exec("Order.storeId NOT NULL", `ALTER TABLE "Order" ALTER COLUMN "storeId" SET NOT NULL`);
  await exec("Order.storeName NOT NULL", `ALTER TABLE "Order" ALTER COLUMN "storeName" SET NOT NULL`);
  await exec("Product.storeId NOT NULL", `ALTER TABLE "Product" ALTER COLUMN "storeId" SET NOT NULL`);

  // เปลี่ยน orderNo จาก unique ทั้งระบบ → unique ต่อร้าน
  await exec("drop Order_orderNo_key", `DROP INDEX IF EXISTS "Order_orderNo_key"`);
  await exec(
    "Order_storeId_orderNo_key",
    `CREATE UNIQUE INDEX IF NOT EXISTS "Order_storeId_orderNo_key" ON "Order"("storeId", "orderNo")`
  );
  await exec("drop Order_status_idx", `DROP INDEX IF EXISTS "Order_status_idx"`);
  await exec(
    "Order_storeId_status_idx",
    `CREATE INDEX IF NOT EXISTS "Order_storeId_status_idx" ON "Order"("storeId", "status")`
  );
  await exec("drop Product_name_idx", `DROP INDEX IF EXISTS "Product_name_idx"`);
  await exec(
    "Product_storeId_name_idx",
    `CREATE INDEX IF NOT EXISTS "Product_storeId_name_idx" ON "Product"("storeId", "name")`
  );

  // FK (เพิ่มเฉพาะถ้ายังไม่มี — Postgres ไม่มี IF NOT EXISTS สำหรับ constraint)
  await exec(
    "Order_storeId_fkey",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_storeId_fkey') THEN
         ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey"
           FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$`
  );
  await exec(
    "User_storeId_fkey",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_storeId_fkey') THEN
         ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey"
           FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$`
  );
  await exec(
    "Product_storeId_fkey",
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_storeId_fkey') THEN
         ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey"
           FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
     END $$`
  );

  console.log("\n✅ migrate-to-multitenant สำเร็จ — รัน `npx prisma db push` ยืนยันว่า schema sync");
}

main()
  .catch((e) => {
    console.error("\n❌ migration ล้มเหลว:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
