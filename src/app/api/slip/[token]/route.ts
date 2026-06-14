import { prisma } from "@/lib/prisma";

/**
 * เสิร์ฟรูปสลิปที่เก็บใน DB → GET /api/slip/<token>
 * token เป็นความลับอยู่แล้ว (เหมือนลิงก์บิล) จึงเปิดดูได้โดยไม่ต้อง login
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const order = await prisma.order.findUnique({
    where: { token },
    select: { paymentSlipData: true, paymentSlipMime: true },
  });

  if (!order?.paymentSlipData) {
    return new Response("Not found", { status: 404 });
  }

  // paymentSlipData (Bytes) → Uint8Array
  const bytes = order.paymentSlipData as unknown as Uint8Array;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": order.paymentSlipMime ?? "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
