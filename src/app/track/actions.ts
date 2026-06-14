"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { orderTotal } from "@/lib/orders";

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
export async function uploadSlip(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const file = formData.get("slip") as File | null;
  if (!token || !file || file.size === 0) return;

  const order = await prisma.order.findUnique({
    where: { token },
    omit: { paymentSlipData: true },
    include: { items: true },
  });
  if (!order) return;

  // เก็บไบต์รูปลง DB โดยตรง (Vercel serverless เขียนไฟล์ลง disk ไม่ได้)
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";

  // ยอดที่ลูกค้าต้องชำระรอบนี้: มัดจำ = depositAmount, จ่ายเต็ม = ยอดรวม
  const total = orderTotal({ items: order.items, shippingFee: order.shippingFee });
  const amount = order.paymentType === "deposit" ? order.depositAmount : total;

  await prisma.order.update({
    where: { token },
    data: {
      paymentSlipData: buffer,
      paymentSlipMime: mime,
      // ใส่ ?v=timestamp กัน browser cache รูปเก่าตอนอัพสลิปใหม่
      paymentSlipUrl: `/api/slip/${token}?v=${Date.now()}`,
      paymentStatus: "pending",
      paymentTransferredAmount: amount,
      paymentTransferredAt: new Date(),
    },
  });

  revalidatePath(`/track/${token}`);
  revalidatePath("/admin");
}
