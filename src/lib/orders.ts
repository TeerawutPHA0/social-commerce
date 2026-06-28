import type { Courier, Order, OrderStatus, PaymentMethod } from "@/types/order";
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

// ฟิลด์รับเงินของร้าน (ดึงสดผ่าน relation) ที่หน้า customer ต้องใช้
type StorePayFields = {
  payAccountName: string;
  payMethods: unknown;
  payQrImage: string | null;
  promptpayId: string;
  payWarning: string | null;
};
type DbOrderForCustomer = DbOrderWithItems & { store: StorePayFields };

/** แปลง row จาก DB → Order type ที่ UI ใช้ */
function mapOrder(o: DbOrderForCustomer): Order {
  return {
    token: o.token,
    orderNo: o.orderNo,
    store: {
      name: o.storeName,
      logo: o.storeLogo,
      pay: {
        accountName: o.store.payAccountName,
        methods: (o.store.payMethods as PaymentMethod[] | null) ?? [],
        qrImage: o.store.payQrImage,
        promptpayId: o.store.promptpayId,
        warning: o.store.payWarning,
      },
    },
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
    include: {
      items: true,
      store: {
        select: {
          payAccountName: true,
          payMethods: true,
          payQrImage: true,
          promptpayId: true,
          payWarning: true,
        },
      },
    },
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

/* ===== กรอง/ค้นหา/แบ่งหน้าฝั่ง DB (Phase 8) =====
   "flow step" เป็นค่า derived (ดู deriveStep) ไม่ใช่คอลัมน์ — จึง map แต่ละ step
   เป็นเงื่อนไข where ที่ตรงกับ logic เดียวกัน เพื่อ filter/count ใน DB ได้ ไม่ต้องโหลดทุกแถว
   หมายเหตุ: ค่าที่อยู่ถูก trim ก่อนเก็บเสมอ → เช็ค "ไม่ว่าง" ด้วย != "" ได้ตรง */

// ดึง type ของ where จาก signature ของ prisma เอง (ไม่ต้อง import Prisma namespace)
type OrderWhere = NonNullable<NonNullable<Parameters<typeof prisma.order.count>[0]>["where"]>;

const ADDRESS_COMPLETE: OrderWhere = {
  shippingName: { not: "" },
  shippingAddress: { not: "" },
  shippingPhone: { not: "" },
};
const PAID: OrderWhere = { paymentStatus: { notIn: ["unpaid", "pending"] } };
const HAS_TRACKING: OrderWhere = { AND: [{ trackingNo: { not: null } }, { trackingNo: { not: "" } }] };
const NO_TRACKING: OrderWhere = { OR: [{ trackingNo: null }, { trackingNo: "" }] };

/** เงื่อนไข where ของแต่ละ flow step (ตรงกับ deriveStep) */
export function stepWhere(step: FlowStep): OrderWhere {
  switch (step) {
    case "address":
      return { OR: [{ shippingName: "" }, { shippingAddress: "" }, { shippingPhone: "" }] };
    case "payment":
      return { AND: [ADDRESS_COMPLETE, { paymentStatus: "unpaid" }] };
    case "verifying":
      return { AND: [ADDRESS_COMPLETE, { paymentStatus: "pending" }] };
    case "delivered":
      return { AND: [ADDRESS_COMPLETE, PAID, { deliveredAt: { not: null } }] };
    case "to_ship":
      return { AND: [ADDRESS_COMPLETE, PAID, { deliveredAt: null }, NO_TRACKING] };
    case "shipping":
      return { AND: [ADDRESS_COMPLETE, PAID, { deliveredAt: null }, HAS_TRACKING] };
  }
}

/** where สำหรับช่องค้นหา (เลขบิล / ชื่อผู้รับ / เบอร์โทร) */
function searchWhere(q: string): OrderWhere {
  return {
    OR: [
      { orderNo: { contains: q, mode: "insensitive" } },
      { shippingName: { contains: q, mode: "insensitive" } },
      { shippingPhone: { contains: q } },
    ],
  };
}

export type ListOrdersOpts = {
  step?: FlowStep | "all";
  q?: string;
  page?: number;
  pageSize?: number;
};

export type ListOrdersResult = {
  orders: DbOrderWithItems[];
  total: number;
  page: number;
  pageSize: number;
};

/** รายการออเดอร์ของร้าน (ใหม่สุดก่อน) — filter/ค้นหา/แบ่งหน้าใน DB */
export async function listOrders(opts: ListOrdersOpts = {}): Promise<ListOrdersResult> {
  const storeId = await getCurrentStoreId();
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const page = Math.max(1, opts.page ?? 1);

  const and: OrderWhere[] = [];
  if (opts.step && opts.step !== "all") and.push(stepWhere(opts.step));
  const q = opts.q?.trim();
  if (q) and.push(searchWhere(q));
  const where: OrderWhere = and.length ? { storeId, AND: and } : { storeId };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, total, page, pageSize };
}

/** ออเดอร์สำหรับ export CSV (ทั้งหมดที่ตรงเงื่อนไข — ช่วงวันที่ + สถานะ) */
export async function ordersForExport(opts: {
  from?: Date;
  to?: Date;
  step?: FlowStep | "all";
}): Promise<DbOrderWithItems[]> {
  const storeId = await getCurrentStoreId();
  const and: OrderWhere[] = [];
  if (opts.step && opts.step !== "all") and.push(stepWhere(opts.step));
  if (opts.from || opts.to) and.push({ createdAt: { gte: opts.from, lte: opts.to } });
  const where: OrderWhere = and.length ? { storeId, AND: and } : { storeId };
  return prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

/** รายได้ที่รับจริง (ออเดอร์ชำระแล้ว) — รวมยอดสินค้า+ค่าส่ง, มัดจำนับเฉพาะยอดมัดจำ
 *  คิดใน DB ด้วย SQL (ไม่ดึงทุกแถวมา loop) */
async function computeRevenue(storeId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ revenue: number }[]>`
    SELECT COALESCE(SUM(
      CASE WHEN o."paymentType" = 'deposit' THEN o."depositAmount"
           ELSE o."shippingFee" + COALESCE(it.total, 0) END
    ), 0)::float8 AS revenue
    FROM "Order" o
    LEFT JOIN (
      SELECT "orderId", SUM("qty" * "price") AS total
      FROM "OrderItem" GROUP BY "orderId"
    ) it ON it."orderId" = o."id"
    WHERE o."storeId" = ${storeId} AND o."paymentStatus" = 'paid'
  `;
  return rows[0]?.revenue ?? 0;
}

/** สถิติของร้านปัจจุบัน — นับแต่ละ flow step ด้วย count query (ใช้ index) ไม่โหลดทุกแถว */
export async function getStats() {
  const storeId = await getCurrentStoreId();
  const [totalOrders, revenue, ...stepCounts] = await Promise.all([
    prisma.order.count({ where: { storeId } }),
    computeRevenue(storeId),
    ...FLOW_STEPS.map((s) => prisma.order.count({ where: { storeId, AND: [stepWhere(s)] } })),
  ]);

  const byStep = {} as Record<FlowStep, number>;
  FLOW_STEPS.forEach((s, i) => {
    byStep[s] = stepCounts[i];
  });

  return { totalOrders, revenue, byStep };
}

export type MonthlySales = { key: string; label: string; revenue: number; orders: number };

const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** ยอดขายรายเดือนย้อนหลัง N เดือน (ชำระแล้ว, ใช้วันที่โอนเงิน) — group ใน DB กรองเฉพาะช่วงที่แสดง */
export async function getMonthlySales(monthsBack = 6): Promise<MonthlySales[]> {
  const storeId = await getCurrentStoreId();
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

  const rows = await prisma.$queryRaw<{ ym: string; revenue: number; orders: number }[]>`
    SELECT to_char(date_trunc('month', COALESCE(o."paymentTransferredAt", o."createdAt")), 'YYYY-MM') AS ym,
           COALESCE(SUM(
             CASE WHEN o."paymentType" = 'deposit' THEN o."depositAmount"
                  ELSE o."shippingFee" + COALESCE(it.total, 0) END
           ), 0)::float8 AS revenue,
           COUNT(*)::int AS orders
    FROM "Order" o
    LEFT JOIN (
      SELECT "orderId", SUM("qty" * "price") AS total
      FROM "OrderItem" GROUP BY "orderId"
    ) it ON it."orderId" = o."id"
    WHERE o."storeId" = ${storeId}
      AND o."paymentStatus" = 'paid'
      AND COALESCE(o."paymentTransferredAt", o."createdAt") >= ${rangeStart}
    GROUP BY ym
  `;
  const byKey = new Map(rows.map((r) => [r.ym, r]));

  // เตรียม bucket ของแต่ละเดือน (เก่า → ใหม่) แล้วเติมจากผล group
  const buckets: MonthlySales[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const r = byKey.get(key);
    buckets.push({
      key,
      label: `${TH_MONTHS_SHORT[d.getMonth()]} ${String((d.getFullYear() + 543) % 100).padStart(2, "0")}`,
      revenue: r?.revenue ?? 0,
      orders: r?.orders ?? 0,
    });
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
