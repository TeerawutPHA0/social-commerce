/**
 * โครงสร้างข้อมูล Order สำหรับหน้า Customer Tracking (Web Bill)
 *
 * หมายเหตุ: ตอนนี้ข้อมูลมาจาก mock store (src/lib/orders.ts)
 * อนาคตจะถูกแทนที่ด้วยข้อมูลจริงจาก Admin Backend (CRUD + สถิติยอดขาย)
 * โดยคงรูปแบบ type เดิมไว้ เพื่อให้ฝั่ง UI ไม่ต้องแก้
 */

/** ลำดับสถานะออเดอร์ — ใช้ทั้งกำหนด timeline และ logic การแสดงผล */
export type OrderStatus = "received" | "preparing" | "shipped" | "delivered";

/** ลำดับ step สำหรับ timeline (เรียงจากซ้ายไปขวา) */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "received",
  "preparing",
  "shipped",
  "delivered",
];

export type PaymentStatus = "unpaid" | "pending" | "paid";

/** ประเภทการชำระเงิน — จ่ายเต็ม หรือ มัดจำ */
export type PaymentType = "full" | "deposit";

/** ค่าขนส่งที่รองรับ + ใช้สร้างลิงก์ติดตามพัสดุ */
export type Courier = "thailand-post" | "kerry" | "flash" | "jt";

/** ช่องทางรับเงิน 1 รายการ (บัญชี/พร้อมเพย์/วอลเล็ต) */
export type PaymentMethod = { label: string; value: string; note?: string };

/** ข้อมูลรับเงินของร้าน (ดึงจาก Store ปัจจุบัน — แก้ได้ที่ /admin/settings) */
export interface StorePaymentInfo {
  accountName: string;
  methods: PaymentMethod[];
  /** path/URL รูป QR (null = ไม่มี) */
  qrImage: string | null;
  /** เลขพร้อมเพย์ ("" = ไม่ใช้) — ใช้ gen QR ตามยอดบิลอัตโนมัติ */
  promptpayId: string;
  warning: string | null;
}

export interface OrderItem {
  name: string;
  qty: number;
  /** ราคาต่อหน่วย (บาท) */
  price: number;
}

export interface Order {
  /** token ลับใน URL เช่น order_9b1a2c3f */
  token: string;
  /** เลขที่ใบสั่งซื้อที่ลูกค้าเห็น เช่น IQ21 */
  orderNo: string;
  store: {
    name: string;
    /** path รูปโลโก้ร้าน (อยู่ใน /public) */
    logo: string;
    /** ข้อมูลรับเงิน (ดึงสดจาก Store ปัจจุบัน — ไม่ใช่ snapshot) */
    pay: StorePaymentInfo;
  };
  /** วันที่สั่งซื้อ (ISO 8601) */
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
  /** ค่าส่ง (บาท) — 0 = ส่งฟรี */
  shippingFee: number;
  shipping: {
    name: string;
    phone: string;
    address: string;
    postcode: string | null;
    email: string | null;
  };
  payment: {
    status: PaymentStatus;
    /** จ่ายเต็ม | มัดจำ */
    type: PaymentType;
    /** ยอดมัดจำ (บาท) — ใช้เมื่อ type = deposit */
    depositAmount: number;
    /** จำนวนเงินที่โอนมาแล้ว (บาท) */
    transferredAmount: number;
    /** วัน/เวลาที่โอน (ISO) หรือ null ถ้ายังไม่โอน */
    transferredAt: string | null;
    /** path รูปสลิปที่ลูกค้าอัพโหลด */
    slipUrl: string | null;
  };
  /** มีค่าเมื่อสถานะเป็น shipped/delivered */
  tracking?: {
    courier: Courier;
    trackingNo: string;
  };
  /** เวลาที่ร้านยืนยันจัดส่งสำเร็จ (ISO) หรือ null */
  deliveredAt: string | null;
  /** ข้อความหมายเหตุจากร้าน (เช่น รอบจัดส่ง) */
  note?: string;
}

/** ข้อมูลที่ admin form ส่งมาตอนสร้าง/แก้ไขออเดอร์ (token + orderNo สร้างฝั่ง server) */
export interface OrderFormInput {
  storeName: string;
  storeLogo: string;
  status: OrderStatus;
  shippingFee: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingPostcode: string | null;
  shippingEmail: string | null;
  paymentStatus: PaymentStatus;
  paymentType: PaymentType;
  /** ยอดมัดจำ (บาท) — ใช้เมื่อ paymentType = deposit */
  depositAmount: number;
  paymentTransferredAmount: number;
  /** ISO string หรือ null */
  paymentTransferredAt: string | null;
  trackingCourier: Courier | null;
  trackingNo: string | null;
  note: string | null;
  items: { name: string; qty: number; price: number }[];
}
