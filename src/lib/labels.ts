import type { Courier, OrderStatus, PaymentStatus } from "@/types/order";

/** ป้ายภาษาไทยของแต่ละ enum — ใช้ใน admin form / dropdown */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "รับออเดอร์",
  preparing: "กำลังเตรียมสินค้า",
  shipped: "จัดส่งแล้ว",
  delivered: "ส่งถึงแล้ว",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "ยังไม่ชำระ",
  pending: "รอตรวจสอบ",
  paid: "ชำระเงินแล้ว",
};

export const COURIER_LABELS: Record<Courier, string> = {
  "thailand-post": "ไปรษณีย์ไทย (EMS)",
  kerry: "Kerry Express",
  flash: "Flash Express",
  jt: "J&T Express",
};
