"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkPassword, startSession, endSession } from "@/lib/auth";
import { getTrackingStatus } from "@/lib/couriers";
import type { Courier, OrderFormInput } from "@/types/order";

/* ===================== Auth actions ===================== */

export async function loginAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) {
    return { error: "รหัสผ่านไม่ถูกต้อง" };
  }
  await startSession();
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

async function genUniqueOrderNo(): Promise<string> {
  for (;;) {
    const n = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
    const orderNo = `PF${n}`;
    const exists = await prisma.order.findUnique({ where: { orderNo } });
    if (!exists) return orderNo;
  }
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
  const token = await genUniqueToken();
  const orderNo = await genUniqueOrderNo();

  await prisma.order.create({
    data: {
      token,
      orderNo,
      ...toData(input),
      items: { create: cleanItems(input.items) },
    },
  });

  revalidatePath("/admin");
  redirect(`/admin?created=${token}&no=${orderNo}`);
}

export async function updateOrder(id: string, input: OrderFormInput): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id }, omit: { paymentSlipData: true } });
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
  const order = await prisma.order.findUnique({ where: { id }, omit: { paymentSlipData: true } });
  if (!order) return;
  await prisma.order.update({
    where: { id },
    data: approve
      ? { paymentStatus: "paid" }
      : {
          paymentStatus: "unpaid",
          paymentSlipUrl: null,
          paymentSlipData: null,
          paymentSlipMime: null,
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
  await prisma.product.create({ data: { name: n, price: Number(price) || 0 } });
  revalidatePath("/admin/products");
  return {};
}

/** แก้ไขสินค้าในแคตตาล็อก */
export async function updateProduct(
  id: string,
  name: string,
  price: number
): Promise<{ error?: string }> {
  const n = name.trim();
  if (!n) return { error: "กรุณากรอกชื่อสินค้า" };
  await prisma.product.update({ where: { id }, data: { name: n, price: Number(price) || 0 } });
  revalidatePath("/admin/products");
  return {};
}

/** ลบสินค้าออกจากแคตตาล็อก (ไม่กระทบออเดอร์เก่า — OrderItem แยกกัน) */
export async function deleteProduct(id: string): Promise<void> {
  await prisma.product.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/products");
}

/* ===================== Delivery ===================== */

/** ร้านยืนยัน/ยกเลิก "จัดส่งสำเร็จ" (ต้องมีเลขพัสดุก่อน) */
export async function markDelivered(id: string, delivered: boolean): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id }, omit: { paymentSlipData: true } });
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
  const order = await prisma.order.findUnique({ where: { id }, omit: { paymentSlipData: true } });
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
  const order = await prisma.order.findUnique({ where: { id }, omit: { paymentSlipData: true } });
  if (!order) return;
  await prisma.order.delete({ where: { id } }); // items ลบตาม (onDelete: Cascade)
  revalidatePath("/admin");
  revalidatePath(`/track/${order.token}`);
}
