import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Resolve "ร้านปัจจุบัน" สำหรับ mutation/อ่านข้อมูล
 *
 * Phase 1 (single-tenant): คืนร้านเริ่มต้นเพียงร้านเดียว (ตาม DEFAULT_STORE_SLUG
 * หรือร้านที่เก่าสุดในระบบ) เพื่อให้แอปทำงานเหมือนเดิมระหว่างที่ schema พร้อมหลายร้านแล้ว
 *
 * Phase 2 (multi-tenant): จะเปลี่ยนมาอ่าน storeId จาก session ของผู้ใช้ที่ล็อกอินแทน
 */
export async function getDefaultStoreId(): Promise<string> {
  const slug = process.env.DEFAULT_STORE_SLUG;
  const store = slug
    ? await prisma.store.findUnique({ where: { slug }, select: { id: true } })
    : await prisma.store.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

  if (!store) {
    throw new Error(
      "ยังไม่มีร้านในระบบ — รัน migration/seed เพื่อสร้างร้านเริ่มต้นก่อน (ดู prisma/seed.ts)"
    );
  }
  return store.id;
}
