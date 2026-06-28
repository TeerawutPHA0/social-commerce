"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { orderTotal, formatTHB } from "@/lib/orders";
import { validateSlip, isRealImage, uploadSlipBlob, deleteSlipBlob } from "@/lib/slip";
import { verifySlip } from "@/lib/slip-verify";
import { notifyMerchant } from "@/lib/notify";
import { appOrigin } from "@/lib/url";

/* Server actions สาธารณะสำหรับลูกค้า (ไม่ต้อง login — อ้างอิงด้วย token) */

/** Prisma unique-constraint error (P2002) — ไม่ต้อง import Prisma namespace */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

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
  data: AddressInput,
  consent: boolean
): Promise<{ error?: string }> {
  if (!data.name.trim() || !data.address.trim() || !data.phone.trim() || !data.postcode.trim()) {
    return { error: "กรุณากรอกชื่อ / ที่อยู่ / รหัสไปรษณีย์ / เบอร์โทรให้ครบ" };
  }
  // PDPA: ต้องยินยอมก่อนเก็บข้อมูลส่วนบุคคล
  if (!consent) return { error: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนบันทึก" };

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
      // บันทึกเวลายินยอมครั้งแรกเป็นหลักฐาน (ไม่ทับของเดิมถ้าเคยยินยอมแล้ว)
      consentAt: order.consentAt ?? new Date(),
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

  // ยอดที่ลูกค้าต้องชำระรอบนี้: มัดจำ = depositAmount, จ่ายเต็ม = ยอดรวม
  const total = orderTotal({ items: order.items, shippingFee: order.shippingFee, discount: order.discount });
  const amount = order.paymentType === "deposit" ? order.depositAmount : total;

  // ตรวจสลิปอัตโนมัติ (ถ้าตั้ง EASYSLIP_API_KEY) — ช่วยร้านตรวจ + ได้เลขอ้างอิงไว้กันสลิปซ้ำ
  // ไม่ตั้ง = status "skipped" → flow เดิม (ร้านตรวจมือ) ไม่เปลี่ยน
  const verdict = await verifySlip(valid.file, { expectedAmount: amount });

  // กันสลิปซ้ำ: เลขอ้างอิงเดียวกันเคยใช้กับบิลอื่นในร้านนี้แล้ว → ปฏิเสธก่อนอัปไฟล์
  if (verdict.transRef) {
    const dup = await prisma.order.findFirst({
      where: { storeId: order.storeId, slipRef: verdict.transRef, NOT: { id: order.id } },
      select: { orderNo: true },
    });
    if (dup) return { error: `สลิปนี้ถูกใช้กับบิล ${dup.orderNo} ไปแล้ว` };
  }

  // อัพรูปขึ้น Vercel Blob (Vercel serverless เขียนไฟล์ลง disk ไม่ได้)
  const slipUrl = await uploadSlipBlob(token, valid.file);

  try {
    await prisma.order.update({
      where: { token },
      data: {
        paymentSlipUrl: slipUrl,
        paymentStatus: "pending",
        paymentTransferredAmount: amount,
        paymentTransferredAt: new Date(),
        slipVerifyStatus: verdict.status === "skipped" ? null : verdict.status,
        slipVerifyNote: verdict.note || null,
        slipRef: verdict.transRef ?? null,
      },
    });
  } catch (e) {
    // ชน unique (storeId, slipRef) แบบ race → สลิปซ้ำ: เก็บกวาดไฟล์ที่เพิ่งอัปแล้วแจ้ง
    await deleteSlipBlob(slipUrl);
    if (isUniqueViolation(e)) return { error: "สลิปนี้ถูกใช้ไปแล้ว" };
    throw e;
  }

  // ลบสลิปเก่าหลัง DB อัปเดตสำเร็จ (กันลบทิ้งแล้ว update fail → ไม่มีรูปเลย)
  await deleteSlipBlob(order.paymentSlipUrl);

  // แจ้งร้านทาง LINE ว่ามีสลิปใหม่รอตรวจ (แนบผลตรวจสลิปถ้ามี · ห้ามพัง flow ถ้าแจ้งไม่สำเร็จ)
  const base = await appOrigin();
  const link = base ? `\n${base}/admin/orders/${order.id}` : "";
  const verifyLine = verdict.note ? `\n${verdict.note}` : "";
  await notifyMerchant(
    order.storeId,
    `💸 มีสลิปใหม่รอตรวจสอบ\nบิล ${order.orderNo} · ${order.shippingName || "ลูกค้า"}\nยอด ฿${formatTHB(amount)}${verifyLine}${link}`
  );

  revalidatePath(`/track/${token}`);
  revalidatePath("/admin");
  return {};
}
