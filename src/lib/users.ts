import "server-only";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

/* โหลดข้อมูลผู้ใช้สำหรับหน้า /admin/account (Phase 9) */

export type CurrentUser = { id: string; email: string; role: string };

/** ผู้ใช้ที่ login อยู่ (id/email/role) */
export async function getCurrentUser(): Promise<CurrentUser> {
  const s = await requireSession();
  return prisma.user.findUniqueOrThrow({
    where: { id: s.userId },
    select: { id: true, email: true, role: true },
  });
}

export type StoreUser = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  /** เป็นบัญชีของผู้ที่ login อยู่หรือไม่ (ห้ามลบตัวเอง) */
  isSelf: boolean;
};

/** รายชื่อผู้ใช้ทั้งหมดของร้านปัจจุบัน (สำหรับ owner จัดการพนักงาน) */
export async function listStoreUsers(): Promise<StoreUser[]> {
  const s = await requireSession();
  const users = await prisma.user.findMany({
    where: { storeId: s.storeId },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    isSelf: u.id === s.userId,
  }));
}
