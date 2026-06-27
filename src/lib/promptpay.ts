import "server-only";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/* สร้าง QR พร้อมเพย์ (PromptPay) ฝังยอดเงินตามบิล — Phase 7
   ลูกค้าสแกนแล้วยอดขึ้นอัตโนมัติ ไม่ต้องพิมพ์เอง (ลดโอนผิดยอด) */

/** เก็บเฉพาะตัวเลขจากเลขพร้อมเพย์ (เบอร์ 10 หลัก / บัตรปชช.|ภาษี 13 หลัก / e-Wallet 15 หลัก) */
export function normalizePromptpayId(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** เลขพร้อมเพย์อยู่ในรูปแบบที่ใช้ได้ไหม (10/13/15 หลัก) */
export function isValidPromptpayId(raw: string): boolean {
  const len = normalizePromptpayId(raw).length;
  return len === 10 || len === 13 || len === 15;
}

/**
 * สร้าง QR พร้อมเพย์เป็น data URL (PNG) ฝังยอด `amount`
 * คืน null ถ้าเลขไม่ถูกต้อง / ยอด <= 0 / สร้างไม่สำเร็จ
 */
export async function promptpayQrDataUrl(
  promptpayId: string,
  amount: number
): Promise<string | null> {
  const id = normalizePromptpayId(promptpayId);
  if (!isValidPromptpayId(id) || !(amount > 0)) return null;
  try {
    const payload = generatePayload(id, { amount });
    return await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  } catch {
    return null;
  }
}
