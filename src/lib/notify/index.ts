import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { linePush, type LineResult } from "./line";

/* ชั้นแจ้งเตือน "ร้าน" (merchant) — Phase 6
   ตอนนี้รองรับ LINE OA; ออกแบบให้เพิ่มช่องทางอื่น (อีเมล) ได้ภายหลังที่นี่ */

/** ส่งข้อความหาร้าน + คืนผลลัพธ์ (ใช้กับปุ่มทดสอบที่อยากเห็น error) */
export async function deliverToMerchant(storeId: string, text: string): Promise<LineResult> {
  const s = await prisma.store.findUnique({
    where: { id: storeId },
    select: { lineNotifyEnabled: true, lineChannelToken: true, lineUserId: true },
  });
  if (!s) return { error: "ไม่พบร้าน" };
  if (!s.lineNotifyEnabled) return { error: "ยังไม่ได้เปิดการแจ้งเตือน LINE" };
  if (!s.lineChannelToken) return { error: "ยังไม่ได้ตั้ง Channel Access Token" };
  if (!s.lineUserId) return { error: "ยังไม่ได้เชื่อม LINE — ทักแชต OA ของร้านก่อน 1 ครั้ง" };

  let token: string;
  try {
    token = decrypt(s.lineChannelToken);
  } catch {
    return { error: "ถอดรหัส token ไม่สำเร็จ (SESSION_SECRET เปลี่ยนไป?) — ตั้ง token ใหม่" };
  }
  return linePush(token, s.lineUserId, text);
}

/** แจ้งเตือนร้านแบบ "ห้ามพัง flow" — กลืน error ทั้งหมด (ใช้ใน server action ปกติ) */
export async function notifyMerchant(storeId: string, text: string): Promise<void> {
  try {
    await deliverToMerchant(storeId, text);
  } catch {
    /* การแจ้งเตือนล้มเหลวต้องไม่กระทบการบันทึกออเดอร์ */
  }
}
