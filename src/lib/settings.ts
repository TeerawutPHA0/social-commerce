import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentStoreId } from "@/lib/store";
import type { PaymentMethod } from "@/types/order";

/** ค่าตั้งร้านที่แก้ได้ที่ /admin/settings */
export type StoreSettings = {
  name: string;
  logo: string;
  defaultShippingFee: number;
  payAccountName: string;
  payQrImage: string;
  payWarning: string;
  payMethods: PaymentMethod[];
};

/** ชื่อ/โลโก้ร้านสำหรับหน้า public ที่ไม่มี session (login, หน้าแรก, หัวแอดมิน)
 *  โมเดล 1: 1 deployment = 1 ร้าน → ดึงร้านเดียวด้วย findFirst (fallback ถ้ายังไม่ bootstrap) */
export async function getStoreBrand(): Promise<{ name: string; logo: string }> {
  const s = await prisma.store.findFirst({ select: { name: true, logo: true } });
  return { name: s?.name ?? "Social Commerce", logo: s?.logo ?? "/logo.svg" };
}

/** สถานะการเชื่อม LINE ของร้าน (ไม่คืนค่าลับ — ใช้แสดงในฟอร์ม settings) */
export type LineSettingsView = {
  enabled: boolean;
  hasToken: boolean;
  hasSecret: boolean;
  /** จับ userId ของร้านจาก webhook แล้วหรือยัง (พร้อมรับ push) */
  connected: boolean;
};

/** โหลดสถานะ LINE ของร้านปัจจุบัน (เฉพาะ flag — ไม่เปิดเผย token/secret) */
export async function getLineSettings(): Promise<LineSettingsView> {
  const storeId = await getCurrentStoreId();
  const s = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: {
      lineNotifyEnabled: true,
      lineChannelToken: true,
      lineChannelSecret: true,
      lineUserId: true,
    },
  });
  return {
    enabled: s.lineNotifyEnabled,
    hasToken: !!s.lineChannelToken,
    hasSecret: !!s.lineChannelSecret,
    connected: !!s.lineUserId,
  };
}

/** โหลดค่าตั้งของร้านปัจจุบัน (สำหรับฟอร์ม settings) */
export async function getStoreSettings(): Promise<StoreSettings> {
  const storeId = await getCurrentStoreId();
  const s = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  return {
    name: s.name,
    logo: s.logo,
    defaultShippingFee: s.defaultShippingFee,
    payAccountName: s.payAccountName,
    payQrImage: s.payQrImage ?? "",
    payWarning: s.payWarning ?? "",
    payMethods: (s.payMethods as PaymentMethod[] | null) ?? [],
  };
}
