import type { Courier, Order, OrderStatus } from "@/types/order";
import { ORDER_STATUS_FLOW } from "@/types/order";
import { prisma } from "@/lib/prisma";
import { getCurrentStoreId } from "@/lib/store";
import type { OrderModel as DbOrder, OrderItemModel as DbOrderItem } from "@/generated/prisma/models";

/* ============================================================
 *  Data access (Prisma / Postgres)
 *  อ่าน/แปลงข้อมูลจาก DB → type Order ที่ฝั่ง UI ใช้
 *  ส่วน mutation (create/update/delete) อยู่ที่ src/app/admin/actions.ts
 * ============================================================ */

type DbOrderWithItems = DbOrder & { items: DbOrderItem[] };

/** แปลง row จาก DB → Order type ที่ UI ใช้ */
function mapOrder(o: DbOrderWithItems): Order {
  return {
    token: o.token,
    orderNo: o.orderNo,
    store: { name: o.storeName, logo: o.storeLogo },
    createdAt: o.createdAt.toISOString(),
    status: o.status as OrderStatus,
    items: o.items.map((it) => ({ name: it.name, qty: it.qty, price: it.price })),
    shippingFee: o.shippingFee,
    shipping: {
      name: o.shippingName,
      phone: o.shippingPhone,
      address: o.shippingAddress,
      postcode: o.shippingPostcode ?? null,
      email: o.shippingEmail ?? null,
    },
    payment: {
      status: o.paymentStatus as Order["payment"]["status"],
      type: o.paymentType as Order["payment"]["type"],
      depositAmount: o.depositAmount,
      transferredAmount: o.paymentTransferredAmount,
      transferredAt: o.paymentTransferredAt?.toISOString() ?? null,
      slipUrl: o.paymentSlipUrl ?? null,
    },
    tracking:
      o.trackingCourier && o.trackingNo
        ? { courier: o.trackingCourier as Courier, trackingNo: o.trackingNo }
        : undefined,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    note: o.note ?? undefined,
  };
}

/** ดึงออเดอร์จาก token (สำหรับหน้า customer — auth ด้วย token เอง ไม่ scope ร้าน) */
export async function getOrderByToken(token: string): Promise<Order | null> {
  const o = await prisma.order.findUnique({
    where: { token },
    include: { items: true },
  });
  return o ? mapOrder(o) : null;
}

/** ดึงออเดอร์จาก id (หน้า admin แก้ไข) — scope เฉพาะร้านของผู้ใช้ปัจจุบัน */
export async function getOrderById(id: string): Promise<DbOrderWithItems | null> {
  const storeId = await getCurrentStoreId();
  return prisma.order.findFirst({
    where: { id, storeId },
    include: { items: true },
  });
}

/** รายการออเดอร์ของร้านปัจจุบัน (ใหม่สุดก่อน) สำหรับ admin */
export async function listOrders(): Promise<DbOrderWithItems[]> {
  const storeId = await getCurrentStoreId();
  return prisma.order.findMany({
    where: { storeId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

/** สถิติยอดขายของร้านปัจจุบัน (นับตาม flow step ที่ derived) */
export async function getStats() {
  const storeId = await getCurrentStoreId();
  const orders = await prisma.order.findMany({
    where: { storeId },
    include: { items: true },
  });

  const byStep: Record<FlowStep, number> = {
    address: 0,
    payment: 0,
    verifying: 0,
    to_ship: 0,
    shipping: 0,
    delivered: 0,
  };
  let revenue = 0; // เงินที่ได้รับจริงจากออเดอร์ที่ชำระแล้ว (มัดจำ = นับเฉพาะยอดมัดจำ)

  for (const o of orders) {
    const step = deriveStep(dbAddressComplete(o), o.paymentStatus, !!o.trackingNo, !!o.deliveredAt);
    byStep[step] += 1;
    if (o.paymentStatus === "paid") {
      const total = o.items.reduce((s, it) => s + it.qty * it.price, 0) + o.shippingFee;
      revenue += o.paymentType === "deposit" ? o.depositAmount : total;
    }
  }

  return { totalOrders: orders.length, revenue, byStep };
}

export type MonthlySales = { key: string; label: string; revenue: number; orders: number };

const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** ยอดขายรายเดือนย้อนหลัง N เดือน (นับเฉพาะออเดอร์ที่ชำระแล้ว, ใช้วันที่โอนเงิน) */
export async function getMonthlySales(monthsBack = 6): Promise<MonthlySales[]> {
  const storeId = await getCurrentStoreId();
  const orders = await prisma.order.findMany({
    where: { storeId, paymentStatus: "paid" },
    include: { items: true },
  });

  // เตรียม bucket ของแต่ละเดือน (เก่า → ใหม่)
  const now = new Date();
  const buckets: MonthlySales[] = [];
  const index = new Map<string, MonthlySales>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b: MonthlySales = {
      key,
      label: `${TH_MONTHS_SHORT[d.getMonth()]} ${String((d.getFullYear() + 543) % 100).padStart(2, "0")}`,
      revenue: 0,
      orders: 0,
    };
    buckets.push(b);
    index.set(key, b);
  }

  for (const o of orders) {
    const date = o.paymentTransferredAt ?? o.createdAt;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const b = index.get(key);
    if (!b) continue; // อยู่นอกช่วงที่แสดง
    const total = o.items.reduce((s, it) => s + it.qty * it.price, 0) + o.shippingFee;
    b.revenue += o.paymentType === "deposit" ? o.depositAmount : total;
    b.orders += 1;
  }

  return buckets;
}

/* ===================== Helpers (pure) ===================== */

/** ยอดรวมสินค้า (ยังไม่รวมค่าส่ง) */
export function itemsSubtotal(order: Pick<Order, "items">): number {
  return order.items.reduce((sum, it) => sum + it.qty * it.price, 0);
}

/** ยอดรวมสุทธิ (สินค้า + ค่าส่ง) */
export function orderTotal(order: Pick<Order, "items" | "shippingFee">): number {
  return itemsSubtotal(order) + order.shippingFee;
}

/** index ของสถานะปัจจุบันใน flow (ใช้กับ timeline) */
export function statusIndex(status: OrderStatus): number {
  return ORDER_STATUS_FLOW.indexOf(status);
}

/* ===== Flow 6 step (derived อัตโนมัติจากสถานะจริง) =====
   address → payment → verifying → to_ship → shipping → delivered
   ระบบเลื่อน step เองตามการกระทำของลูกค้า/ร้าน ไม่ต้องตั้งค่า status มือ
   (delivered = ร้านกดยืนยันจัดส่งสำเร็จ) */
export type FlowStep =
  | "address"
  | "payment"
  | "verifying"
  | "to_ship"
  | "shipping"
  | "delivered";

export const FLOW_STEPS: FlowStep[] = [
  "address",
  "payment",
  "verifying",
  "to_ship",
  "shipping",
  "delivered",
];

export const FLOW_LABELS: Record<FlowStep, string> = {
  address: "รอที่อยู่จัดส่ง",
  payment: "รอชำระเงิน",
  verifying: "ตรวจสอบการชำระเงิน",
  to_ship: "ที่ต้องจัดส่ง",
  shipping: "กำลังจัดส่งสินค้า",
  delivered: "จัดส่งสำเร็จ",
};

/** หา step ปัจจุบันจากสถานะจริง (ที่อยู่ครบ? จ่าย? มีเลขพัสดุ? ส่งสำเร็จ?) */
export function deriveStep(
  addressComplete: boolean,
  paymentStatus: string,
  hasTracking: boolean,
  delivered: boolean
): FlowStep {
  if (!addressComplete) return "address";
  if (paymentStatus === "unpaid") return "payment";
  if (paymentStatus === "pending") return "verifying";
  if (delivered) return "delivered";
  if (!hasTracking) return "to_ship";
  return "shipping";
}

/** ยอดที่ลูกค้าต้องชำระรอบนี้ — มัดจำ = depositAmount, จ่ายเต็ม = ยอดรวม */
export function amountDue(
  paymentType: string,
  depositAmount: number,
  total: number
): number {
  return paymentType === "deposit" ? depositAmount : total;
}

export function flowStepIndex(step: FlowStep): number {
  return FLOW_STEPS.indexOf(step);
}

/** เช็คฟิลด์ที่อยู่จาก DB row โดยตรง (ใช้ในหน้า admin) */
export function dbAddressComplete(o: {
  shippingName: string;
  shippingAddress: string;
  shippingPhone: string;
}): boolean {
  return Boolean(o.shippingName.trim() && o.shippingAddress.trim() && o.shippingPhone.trim());
}

/** ที่อยู่จัดส่งกรอกครบหรือยัง (ชื่อ + ที่อยู่ + เบอร์โทร) */
export function isAddressComplete(order: Order): boolean {
  const s = order.shipping;
  return Boolean(s.name.trim() && s.address.trim() && s.phone.trim());
}

/** จัดรูปแบบเงินบาท เช่น 1290 → "1,290.00" */
export function formatTHB(amount: number): string {
  return amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** จัดรูปแบบวันเวลา ISO → "29/05/2026 14:35" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/* ===================== Courier ===================== */

const COURIER_INFO: Record<Courier, { label: string; trackUrl: (no: string) => string }> = {
  "thailand-post": {
    label: "ไปรษณีย์ไทย (EMS)",
    trackUrl: (no) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(no)}`,
  },
  kerry: {
    label: "Kerry Express",
    trackUrl: (no) => `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(no)}`,
  },
  flash: {
    label: "Flash Express",
    trackUrl: (no) => `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(no)}`,
  },
  jt: {
    label: "J&T Express",
    trackUrl: (no) =>
      `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${encodeURIComponent(no)}`,
  },
};

export function courierLabel(courier: Courier): string {
  return COURIER_INFO[courier].label;
}

export function courierTrackUrl(courier: Courier, trackingNo: string): string {
  return COURIER_INFO[courier].trackUrl(trackingNo);
}
