import "server-only";
import { formatTHB } from "@/lib/orders";
import { easySlipVerifier } from "./easyslip";
import { matchAmount } from "./match";
import type { SlipVerifier } from "./types";

/* จุดเข้าใช้งานเดียวของการตรวจสลิป — เลือก provider จาก env (ตอนนี้รองรับ EasySlip)
   ไม่มี key = คืน status "skipped" → flow เดิม (ร้านตรวจมือ) ไม่เปลี่ยน */

export type SlipVerifyOutcome = {
  /** verified = สลิปจริง+ยอดตรง · amount_mismatch = จริงแต่ยอดไม่ตรง · failed = อ่าน/ตรวจไม่ผ่าน · skipped = ไม่ได้เปิดใช้ */
  status: "verified" | "amount_mismatch" | "failed" | "skipped";
  /** ข้อความสรุปให้ร้านอ่าน ("" เมื่อ skipped) */
  note: string;
  /** เลขอ้างอิงรายการ (กันสลิปซ้ำ) — มีเฉพาะตอนอ่านสลิปได้ */
  transRef?: string;
};

function getVerifier(): SlipVerifier | null {
  const key = process.env.EASYSLIP_API_KEY;
  if (key) return easySlipVerifier(key);
  return null;
}

/** มีผู้ให้บริการตรวจสลิปตั้งค่าไว้ไหม (ไว้ตัดสินใจในหน้า UI/flow) */
export function slipVerifyConfigured(): boolean {
  return getVerifier() !== null;
}

/**
 * ตรวจสลิปกับ provider แล้วเทียบยอดที่ต้องชำระ
 * - ไม่ throw: ความล้มเหลวของ provider คืน status "failed" (ไม่ทำให้ flow อัปสลิปพัง)
 * - การจับคู่บัญชีผู้รับทำแบบ "แสดงให้ดู" ไม่ฟันธง (เลขบัญชีถูก mask → เทียบตรงไม่ได้แน่นอน)
 */
export async function verifySlip(
  file: File,
  ctx: { expectedAmount: number }
): Promise<SlipVerifyOutcome> {
  const verifier = getVerifier();
  if (!verifier) return { status: "skipped", note: "" };

  const r = await verifier.verify(file);
  if (!r.genuine) {
    return { status: "failed", note: `⚠️ ${r.error}` };
  }

  const recv = r.receiverAccount ? ` · เข้า ${r.receiverAccount}` : "";
  const amountMatch = matchAmount(r.amount, ctx.expectedAmount);
  const amountKnown = amountMatch !== null;

  if (amountMatch === false) {
    return {
      status: "amount_mismatch",
      note: `⚠️ ยอดในสลิป ฿${formatTHB(r.amount!)} ไม่ตรงกับที่ต้องชำระ ฿${formatTHB(ctx.expectedAmount)}${recv}`,
      transRef: r.transRef,
    };
  }

  const amountText = amountKnown ? ` · ยอด ฿${formatTHB(r.amount!)} ตรง` : "";
  return {
    status: "verified",
    note: `✅ สลิปจริง${amountText}${recv}`,
    transRef: r.transRef,
  };
}
