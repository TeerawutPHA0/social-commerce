/* โครงสร้างกลางของ "ตัวเชื่อมขนส่ง" (courier adapter) — ทุกเจ้าคืนรูปแบบเดียวกัน
   เพิ่มขนส่งใหม่ = เขียนโมดูลที่ implement CourierAdapter แล้วลงทะเบียนใน index.ts */

export type TrackEntry = { description: string; date: string; location?: string };

export type TrackResult = {
  /** ตั้งค่า API key/credentials ของขนส่งเจ้านี้แล้วหรือยัง */
  configured: boolean;
  /** เจอข้อมูลพัสดุไหม */
  found: boolean;
  /** นำจ่ายสำเร็จแล้วหรือยัง */
  delivered: boolean;
  /** สถานะล่าสุด (ข้อความ) */
  statusDescription?: string;
  statusDate?: string;
  history?: TrackEntry[];
  error?: string;
};

export interface CourierAdapter {
  /** ตั้งค่า credentials ครบไหม (ถ้าไม่ → ปุ่มเช็คจะปิด) */
  isConfigured(): boolean;
  /** เช็คสถานะพัสดุจากเลขบาร์โค้ด */
  getStatus(barcode: string): Promise<TrackResult>;
}

/** คำที่บ่งบอกว่า "นำจ่ายสำเร็จ" — ใช้ร่วมกันหลายเจ้า */
export function descriptionMeansDelivered(desc: string): boolean {
  return /นำจ่ายสำเร็จ|จัดส่งสำเร็จ|ส่งสำเร็จ|delivered|signed/i.test(desc);
}
