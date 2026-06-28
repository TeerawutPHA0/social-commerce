/* ตรวจสลิปโอนเงินกับผู้ให้บริการภายนอก (กันสลิปปลอม/ยอดไม่ตรง/สลิปซ้ำ)
   ออกแบบเป็น pluggable เหมือน lib/couriers — มี env key ของเจ้าไหน → ใช้เจ้านั้น
   ไม่มี key = ปิดเงียบ กลับไปตรวจด้วยตาเหมือนเดิม (ดู lib/slip-verify/index.ts) */

/** ผลดิบจากผู้ให้บริการ (ยังไม่เทียบยอด/บัญชี — index.ts เป็นคนเทียบ) */
export type SlipParseResult =
  | {
      genuine: true;
      /** เลขอ้างอิงรายการ (transRef) — ใช้กันสลิปซ้ำ */
      transRef?: string;
      /** ยอดในสลิป (บาท) */
      amount?: number;
      /** เวลาโอนตามสลิป */
      paidAt?: Date;
      /** ชื่อผู้รับ (อาจถูก mask) — แสดงให้ร้านดูประกอบ */
      receiverName?: string;
      /** บัญชี/พร้อมเพย์ผู้รับ (อาจถูก mask เช่น 081-xxx-x789) */
      receiverAccount?: string;
    }
  | {
      genuine: false;
      /** เหตุผลภาษาคน (อ่านไม่ออก / โควต้าหมด / ฯลฯ) */
      error: string;
    };

export interface SlipVerifier {
  /** อ่านสลิปจากไฟล์รูป — คืนผลดิบ (ไม่ throw; แปลง error เป็น genuine:false) */
  verify(file: File): Promise<SlipParseResult>;
}
