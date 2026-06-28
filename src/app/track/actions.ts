"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { orderTotal, formatTHB } from "@/lib/orders";
import { validateSlip, isRealImage, uploadSlipBlob, deleteSlipBlob } from "@/lib/slip";
import { notifyMerchant } from "@/lib/notify";
import { appOrigin } from "@/lib/url";

/* Server actions สาธารณะสำหรับลูกค้า (ไม่ต้อง login — อ้างอิงด้วย token) */

type AddressInput = {
  name: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
};

/** ลูกค้ากรอก/แก้ที่อยู่จัดส่ง */
export async function submitAddress(
  token: string,
  data: AddressInput
): Promise<{ error?: string }> {
  if (!data.name.trim() || !data.address.trim() || !data.phone.trim() || !data.postcode.trim()) {
    return { error: "กรุณากรอกชื่อ / ที่อยู่ / รหัสไปรษณีย์ / เบอร์โทรให้ครบ" };
  }
  const order = await prisma.order.findUnique({ where: { token } });
  if (!order) return { error: "ไม่พบออเดอร์" };

  await prisma.order.update({
    where: { token },
    data: {
      shippingName: data.name.trim(),
      shippingAddress: data.address.trim(),
      shippingPostcode: data.postcode.trim(),
      shippingPhone: data.phone.trim(),
      shippingEmail: data.email.trim() || null,
    },
  });

  revalidatePath(`/track/${token}`);
  return {};
}

/** ลูกค้าอัพโหลดสลิป → สถานะการชำระเงิน = รอตรวจสอบ (pending) */
export async function uploadSlip(formData: FormData): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "");
  const valid = validateSlip(formData.get("slip") as File | null);
  if (!valid.ok) return { error: valid.error };
  if (!token) return { error: "ไม่พบออเดอร์" };
  // ตรวจเนื้อไฟล์จริง (กันปลอม Content-Type)
  if (!(await isRealImage(valid.file))) return { error: "ไฟล์ไม่ใช่รูปภาพที่รองรับ" };

  const order = await prisma.order.findUnique({
    where: { token },
    include: { items: true },
  });
  if (!order) return { error: "ไม่พบออเดอร์" };

  // อัพรูปขึ้น Vercel Blob (Vercel serverless เขียนไฟล์ลง disk ไม่ได้)
  const slipUrl = await uploadSlipBlob(token, valid.file);

  // ยอดที่ลูกค้าต้องชำระรอบนี้: มัดจำ = depositAmount, จ่ายเต็ม = ยอดรวม
  const total = orderTotal({ items: order.items, shippingFee: order.shippingFee, discount: order.discount });
  const amount = order.paymentType === "deposit" ? order.depositAmount : total;

  await prisma.order.update({
    where: { token },
    data: {
      paymentSlipUrl: slipUrl,
      paymentStatus: "pending",
      paymentTransferredAmount: amount,
      paymentTransferredAt: new Date(),
    },
  });

  // ลบสลิปเก่าหลัง DB อัปเดตสำเร็จ (กันลบทิ้งแล้ว update fail → ไม่มีรูปเลย)
  await deleteSlipBlob(order.paymentSlipUrl);

  // แจ้งร้านทาง LINE ว่ามีสลิปใหม่รอตรวจ (ห้ามพัง flow ถ้าแจ้งไม่สำเร็จ)
  const base = await appOrigin();
  const link = base ? `\n${base}/admin/orders/${order.id}` : "";
  await notifyMerchant(
    order.storeId,
    `💸 มีสลิปใหม่รอตรวจสอบ\nบิล ${order.orderNo} · ${order.shippingName || "ลูกค้า"}\nยอด ฿${formatTHB(amount)}${link}`
  );

  revalidatePath(`/track/${token}`);
  revalidatePath("/admin");
  return {};
}
