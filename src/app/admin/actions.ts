"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  startSession,
  endSession,
  clientIp,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
} from "@/lib/auth";
import { getTrackingStatus } from "@/lib/couriers";
import { getCurrentStoreId } from "@/lib/store";
import { deleteSlipBlob } from "@/lib/slip";
import type { Courier, OrderFormInput, PaymentMethod } from "@/types/order";
import type { StoreSettings } from "@/lib/settings";

/* ===================== Auth actions ===================== */

export async function loginAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const ip = await clientIp();
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return { error: `พยายามเข้าสู่ระบบบ่อยเกินไป ลองใหม่ใน ${limit.retryAfterSec} วินาที` };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pw = String(formData.get("password") ?? "");

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;
  // verify เสมอ (แม้ไม่เจอ user) เพื่อลด timing leak ว่า email มีอยู่ไหม
  const ok = user ? await verifyPassword(pw, user.passwordHash) : false;
  if (!user || !ok) {
    recordFailedAttempt(ip);
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  clearAttempts(ip);
  await startSession({ id: user.id, storeId: user.storeId, role: user.role });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/admin/login");
}

/* ===================== Order CRUD ===================== */

async function genUniqueToken(): Promise<string> {
  for (;;) {
    const token = "order_" + crypto.randomBytes(4).toString("hex"); // 8 hex
    const exists = await prisma.order.findUnique({ where: { token } });
    if (!exists) return token;
  }
}

async function genUniqueOrderNo(storeId: string): Promise<string> {
  for (;;) {
    const n = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
    const orderNo = `PF${n}`;
    const exists = await prisma.order.findUnique({
      where: { storeId_orderNo: { storeId, orderNo } },
    });
    if (!exists) return orderNo;
  }
}

/** หาออเดอร์ตาม id เฉพาะของร้านปัจจุบัน (กันแก้/ลบข้ามร้าน) — null ถ้าไม่ใช่ของร้านนี้ */
async function findOwnedOrder(id: string) {
  const storeId = await getCurrentStoreId();
  return prisma.order.findFirst({ where: { id, storeId } });
}

/** แปลง input ฝั่ง form → ฟิลด์ของ DB (sanitize ค่าตัวเลข/ค่าว่าง) */
function toData(input: OrderFormInput) {
  const hasTracking = !!input.trackingCourier && !!input.trackingNo?.trim();
  const isDeposit = input.paymentType === "deposit";
  return {
    storeName: input.storeName.trim() || "puffiepiece",
    storeLogo: input.storeLogo.trim() || "/logo.jpg",
    status: input.status,
    shippingFee: Number(input.shippingFee) || 0,
    shippingName: input.shippingName.trim(),
    shippingPhone: input.shippingPhone.trim(),
    shippingAddress: input.shippingAddress.trim(),
    shippingPostcode: input.shippingPostcode?.trim() || null,
    shippingEmail: input.shippingEmail?.trim() || null,
    paymentType: isDeposit ? "deposit" : "full",
    depositAmount: isDeposit ? Number(input.depositAmount) || 0 : 0,
    paymentStatus: input.paymentStatus,
    paymentTransferredAmount: Number(input.paymentTransferredAmount) || 0,
    paymentTransferredAt: input.paymentTransferredAt
      ? new Date(input.paymentTransferredAt)
      : null,
    trackingCourier: hasTracking ? input.trackingCourier : null,
    trackingNo: hasTracking ? input.trackingNo!.trim() : null,
    note: input.note?.trim() ? input.note.trim() : null,
  };
}

function cleanItems(items: OrderFormInput["items"]) {
  return items
    .filter((it) => it.name.trim().length > 0)
    .map((it) => ({
      name: it.name.trim(),
      qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
      price: Number(it.price) || 0,
    }));
}

export async function createOrder(input: OrderFormInput): Promise<void> {
  const storeId = await getCurrentStoreId();
  const token = await genUniqueToken();
  const orderNo = await genUniqueOrderNo(storeId);

  await prisma.order.create({
    data: {
      token,
      orderNo,
      storeId,
      ...toData(input),
      items: { create: cleanItems(input.items) },
    },
  });

  revalidatePath("/admin");
  redirect(`/admin?created=${token}&no=${orderNo}`);
}

export async function updateOrder(id: string, input: OrderFormInput): Promise<void> {
  const order = await findOwnedOrder(id);
  if (!order) throw new Error("ไม่พบออเดอร์");

  // อัปเดตฟิลด์ + แทนที่รายการสินค้าทั้งหมด (ลบเก่า → สร้างใหม่) ใน transaction เดียว
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: id } }),
    prisma.order.update({
      where: { id },
      data: {
        ...toData(input),
        items: { create: cleanItems(input.items) },
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath(`/track/${order.token}`);
  redirect("/admin");
}

/** ร้านตรวจสลิป: approve → ชำระแล้ว, reject → กลับเป็นยังไม่ชำระ + ลบสลิป */
export async function verifyPayment(id: string, approve: boolean): Promise<void> {
  const order = await findOwnedOrder(id);
  if (!order) return;
  if (!approve) await deleteSlipBlob(order.paymentSlipUrl);
  await prisma.order.update({
    where: { id },
    data: approve
      ? { paymentStatus: "paid" }
      : {
          paymentStatus: "unpaid",
          paymentSlipUrl: null,
          paymentTransferredAt: null,
        },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/track/${order.token}`);
}

/* ===================== Product catalog ===================== */

/** เพิ่มสินค้าเข้าแคตตาล็อก */
export async function createProduct(name: string, price: number): Promise<{ error?: string }> {
  const n = name.trim();
  if (!n) return { error: "กรุณากรอกชื่อสินค้า" };
  const storeId = await getCurrentStoreId();
  await prisma.product.create({ data: { name: n, price: Number(price) || 0, storeId } });
  revalidatePath("/admin/products");
  return {};
}

/** แก้ไขสินค้าในแคตตาล็อก (เฉพาะของร้านปัจจุบัน) */
export async function updateProduct(
  id: string,
  name: string,
  price: number
): Promise<{ error?: string }> {
  const n = name.trim();
  if (!n) return { error: "กรุณากรอกชื่อสินค้า" };
  const storeId = await getCurrentStoreId();
  const res = await prisma.product.updateMany({
    where: { id, storeId },
    data: { name: n, price: Number(price) || 0 },
  });
  if (res.count === 0) return { error: "ไม่พบสินค้า" };
  revalidatePath("/admin/products");
  return {};
}

/** ลบสินค้าออกจากแคตตาล็อก เฉพาะของร้านปัจจุบัน (ไม่กระทบออเดอร์เก่า — OrderItem แยกกัน) */
export async function deleteProduct(id: string): Promise<void> {
  const storeId = await getCurrentStoreId();
  await prisma.product.deleteMany({ where: { id, storeId } });
  revalidatePath("/admin/products");
}

/* ===================== Store settings ===================== */

/** บันทึกค่าตั้งร้าน (ชื่อ/โลโก้/ค่าส่ง/ข้อมูลรับเงิน) — เฉพาะร้านปัจจุบัน */
export async function updateStoreSettings(input: StoreSettings): Promise<{ error?: string }> {
  const storeId = await getCurrentStoreId();

  const name = input.name.trim();
  if (!name) return { error: "กรุณากรอกชื่อร้าน" };

  // เก็บเฉพาะช่องทางที่มีทั้งชื่อและเลขบัญชี (ไม่ใส่ key note ถ้าว่าง — กัน undefined ใน JSON)
  const methods: PaymentMethod[] = (input.payMethods ?? [])
    .map((m) => {
      const label = m.label.trim();
      const value = m.value.trim();
      const note = m.note?.trim();
      return note ? { label, value, note } : { label, value };
    })
    .filter((m) => m.label && m.value);

  await prisma.store.update({
    where: { id: storeId },
    data: {
      name,
      logo: input.logo.trim() || "/logo.jpg",
      defaultShippingFee: Math.max(0, Number(input.defaultShippingFee) || 0),
      payAccountName: input.payAccountName.trim(),
      payQrImage: input.payQrImage.trim() || null,
      payWarning: input.payWarning.trim() || null,
      payMethods: methods,
    },
  });

  revalidatePath("/admin/settings");
  return {};
}

/* ===================== Delivery ===================== */

/** ร้านยืนยัน/ยกเลิก "จัดส่งสำเร็จ" (ต้องมีเลขพัสดุก่อน) */
export async function markDelivered(id: string, delivered: boolean): Promise<void> {
  const order = await findOwnedOrder(id);
  if (!order) return;
  await prisma.order.update({
    where: { id },
    data: { deliveredAt: delivered ? new Date() : null },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/track/${order.token}`);
}

/** เช็คสถานะพัสดุกับขนส่ง (ตาม courier ของออเดอร์) — ถ้านำจ่ายสำเร็จจะ set deliveredAt อัตโนมัติ */
export async function checkTracking(id: string): Promise<{
  ok: boolean;
  delivered?: boolean;
  description?: string;
  date?: string;
  error?: string;
}> {
  const order = await findOwnedOrder(id);
  if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
  if (!order.trackingCourier || !order.trackingNo) {
    return { ok: false, error: "ออเดอร์นี้ยังไม่มีเลขพัสดุ" };
  }

  const res = await getTrackingStatus(order.trackingCourier as Courier, order.trackingNo);
  if (!res.configured || res.error) return { ok: false, error: res.error };
  if (!res.found) {
    return { ok: true, delivered: false, description: "ยังไม่พบข้อมูลการนำจ่าย (พัสดุอาจเพิ่งฝากส่ง)" };
  }

  // นำจ่ายสำเร็จ → อัปเดตสถานะออเดอร์เป็น "จัดส่งสำเร็จ"
  if (res.delivered && !order.deliveredAt) {
    await prisma.order.update({ where: { id }, data: { deliveredAt: new Date() } });
    revalidatePath("/admin");
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath(`/track/${order.token}`);
  }

  return {
    ok: true,
    delivered: res.delivered,
    description: res.statusDescription,
    date: res.statusDate,
  };
}

export async function deleteOrder(id: string): Promise<void> {
  const order = await findOwnedOrder(id);
  if (!order) return;
  await deleteSlipBlob(order.paymentSlipUrl);
  await prisma.order.delete({ where: { id } }); // items ลบตาม (onDelete: Cascade)
  revalidatePath("/admin");
  revalidatePath(`/track/${order.token}`);
}
