"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  startSession,
  endSession,
  requireSession,
  requireOwner,
  clientIp,
} from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt, clearAttempts } from "@/lib/ratelimit";
import { getTrackingStatus } from "@/lib/couriers";
import { getCurrentStoreId } from "@/lib/store";
import { deleteSlipBlob, validateSlip, isRealImage } from "@/lib/slip";
import { uploadProductImage, deleteProductImage } from "@/lib/productImage";
import { encrypt } from "@/lib/crypto";
import { deliverToMerchant } from "@/lib/notify";
import type { Courier, OrderFormInput, PaymentMethod } from "@/types/order";
import type { StoreSettings } from "@/lib/settings";

/* ===================== Auth actions ===================== */

export async function loginAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const ip = await clientIp();
  const limit = await checkRateLimit(ip);
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
    await recordFailedAttempt(ip);
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  await clearAttempts(ip);
  await startSession({ id: user.id, storeId: user.storeId, role: user.role });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/admin/login");
}

/* ===================== Account / users (Phase 9) ===================== */

const MIN_PASSWORD = 8;

/** เปลี่ยนรหัสผ่านตัวเอง (ทุก role) — ต้องยืนยันรหัสเดิม */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok?: boolean; error?: string }> {
  const session = await requireSession();
  if (newPassword.length < MIN_PASSWORD) {
    return { error: `รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` };
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  return { ok: true };
}

/** เพิ่มพนักงาน (owner เท่านั้น) — ผูกกับร้านของ owner */
export async function addStaff(email: string, password: string): Promise<{ error?: string }> {
  const session = await requireOwner();
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { error: "อีเมลไม่ถูกต้อง" };
  if (password.length < MIN_PASSWORD) {
    return { error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` };
  }
  if (await prisma.user.findUnique({ where: { email: e } })) {
    return { error: "อีเมลนี้ถูกใช้แล้ว" };
  }
  await prisma.user.create({
    data: { email: e, passwordHash: await hashPassword(password), role: "staff", storeId: session.storeId },
  });
  revalidatePath("/admin/account");
  return {};
}

/** ลบพนักงาน (owner เท่านั้น) — ลบได้เฉพาะ staff ในร้านเดียวกัน, ห้ามลบตัวเอง/owner */
export async function removeStaff(userId: string): Promise<{ error?: string }> {
  const session = await requireOwner();
  if (userId === session.userId) return { error: "ลบบัญชีตัวเองไม่ได้" };
  const res = await prisma.user.deleteMany({
    where: { id: userId, storeId: session.storeId, role: "staff" },
  });
  if (res.count === 0) return { error: "ลบไม่ได้ (ไม่พบ หรือเป็นบัญชี owner)" };
  revalidatePath("/admin/account");
  return {};
}

/* ===================== Order CRUD ===================== */

async function genUniqueToken(): Promise<string> {
  for (;;) {
    const token = "order_" + crypto.randomBytes(16).toString("hex"); // 32 hex (กันเดา URL)
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

/** ชื่อ/โลโก้ของร้าน — ใช้เป็น snapshot สำรองตอนสร้าง/แก้ออเดอร์ */
async function storeBrand(storeId: string): Promise<{ name: string; logo: string }> {
  return prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { name: true, logo: true },
  });
}

/** แปลง input ฝั่ง form → ฟิลด์ของ DB (sanitize ค่าตัวเลข/ค่าว่าง)
 *  brand = ชื่อ/โลโก้ร้าน ใช้เป็น snapshot สำรองเมื่อ form ไม่ได้ส่งมา (de-hardcode จากแบรนด์เดิม) */
function toData(input: OrderFormInput, brand: { name: string; logo: string }) {
  const hasTracking = !!input.trackingCourier && !!input.trackingNo?.trim();
  const isDeposit = input.paymentType === "deposit";
  return {
    storeName: input.storeName.trim() || brand.name,
    storeLogo: input.storeLogo.trim() || brand.logo,
    status: input.status,
    shippingFee: Number(input.shippingFee) || 0,
    discount: Math.max(0, Number(input.discount) || 0),
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
  const brand = await storeBrand(storeId);

  await prisma.order.create({
    data: {
      token,
      orderNo,
      storeId,
      ...toData(input, brand),
      items: { create: cleanItems(input.items) },
    },
  });

  revalidatePath("/admin");
  redirect(`/admin?created=${token}&no=${orderNo}`);
}

export async function updateOrder(id: string, input: OrderFormInput): Promise<void> {
  const order = await findOwnedOrder(id);
  if (!order) throw new Error("ไม่พบออเดอร์");
  const brand = await storeBrand(order.storeId);

  // อัปเดตฟิลด์ + แทนที่รายการสินค้าทั้งหมด (ลบเก่า → สร้างใหม่) ใน transaction เดียว
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: id } }),
    prisma.order.update({
      where: { id },
      data: {
        ...toData(input, brand),
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
  const p = await prisma.product.findFirst({ where: { id, storeId }, select: { image: true } });
  await prisma.product.deleteMany({ where: { id, storeId } });
  if (p?.image) await deleteProductImage(p.image);
  revalidatePath("/admin/products");
}

/** อัพโหลดรูปสินค้า (เฉพาะของร้านปัจจุบัน) — แทนที่รูปเก่าถ้ามี */
export async function setProductImage(id: string, formData: FormData): Promise<{ error?: string }> {
  const storeId = await getCurrentStoreId();
  const valid = validateSlip(formData.get("image") as File | null);
  if (!valid.ok) return { error: valid.error };
  if (!(await isRealImage(valid.file))) return { error: "ไฟล์ไม่ใช่รูปภาพที่รองรับ" };
  const product = await prisma.product.findFirst({ where: { id, storeId }, select: { image: true } });
  if (!product) return { error: "ไม่พบสินค้า" };

  const url = await uploadProductImage(valid.file);
  await prisma.product.update({ where: { id }, data: { image: url } });
  await deleteProductImage(product.image); // ลบรูปเก่าหลังอัพใหม่สำเร็จ
  revalidatePath("/admin/products");
  return {};
}

/** ลบรูปสินค้า */
export async function removeProductImage(id: string): Promise<void> {
  const storeId = await getCurrentStoreId();
  const product = await prisma.product.findFirst({ where: { id, storeId }, select: { image: true } });
  if (!product?.image) return;
  await prisma.product.update({ where: { id }, data: { image: null } });
  await deleteProductImage(product.image);
  revalidatePath("/admin/products");
}

/* ===================== Store settings ===================== */

/** บันทึกค่าตั้งร้าน (ชื่อ/โลโก้/ค่าส่ง/ข้อมูลรับเงิน) — เฉพาะร้านปัจจุบัน */
export async function updateStoreSettings(input: StoreSettings): Promise<{ error?: string }> {
  const { storeId } = await requireOwner();

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
      promptpayId: (input.promptpayId ?? "").replace(/[^0-9]/g, ""),
      payWarning: input.payWarning.trim() || null,
      payMethods: methods,
    },
  });

  revalidatePath("/admin/settings");
  return {};
}

/* ===================== LINE notify (Phase 6) ===================== */

export type LineSettingsInput = {
  enabled: boolean;
  /** "" = ไม่เปลี่ยน (เก็บค่าเดิม) — ฟอร์มแสดงเป็นช่องว่างเมื่อมีค่าอยู่แล้ว */
  channelToken: string;
  channelSecret: string;
};

/** บันทึกการตั้งค่า LINE ของร้าน — เข้ารหัส token/secret ก่อนเก็บ (เฉพาะร้านปัจจุบัน) */
export async function updateLineSettings(
  input: LineSettingsInput
): Promise<{ error?: string }> {
  const { storeId } = await requireOwner();
  const data: {
    lineNotifyEnabled: boolean;
    lineChannelToken?: string;
    lineChannelSecret?: string;
  } = { lineNotifyEnabled: input.enabled };

  const token = input.channelToken.trim();
  const secret = input.channelSecret.trim();
  if (token) data.lineChannelToken = encrypt(token);
  if (secret) data.lineChannelSecret = encrypt(secret);

  await prisma.store.update({ where: { id: storeId }, data });
  revalidatePath("/admin/settings");
  return {};
}

/** ส่งข้อความทดสอบไปยัง LINE ของร้าน (ปุ่ม "ทดสอบส่ง" ในหน้า settings) */
export async function sendLineTest(): Promise<{ ok?: boolean; error?: string }> {
  const { storeId } = await requireOwner();
  return deliverToMerchant(
    storeId,
    "🔔 ทดสอบการแจ้งเตือนจากระบบร้านค้า — ถ้าเห็นข้อความนี้แปลว่าเชื่อมต่อสำเร็จแล้ว ✅"
  );
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
