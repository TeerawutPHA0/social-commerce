import "server-only";
import { requireSession } from "@/lib/auth";

/**
 * storeId ของร้านที่ผู้ใช้ปัจจุบันสังกัด (จาก session)
 * ใช้ scope ทุก query/mutation ฝั่ง admin ให้เห็นเฉพาะข้อมูลของร้านตัวเอง
 *
 * ⚠️ ห้ามใช้ในบริบทที่ไม่มี session (เช่น customer track, scripts) — จะเด้ง login
 */
export async function getCurrentStoreId(): Promise<string> {
  const session = await requireSession();
  return session.storeId;
}
