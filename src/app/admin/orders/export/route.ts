import { ordersForExport, FLOW_STEPS, type FlowStep } from "@/lib/orders";
import { toCsv } from "@/lib/csv";

/* ดาวน์โหลดออเดอร์เป็น CSV (กรองช่วงวันที่ + สถานะ) — auth ผ่าน getCurrentStoreId ใน ordersForExport
   (ไม่ได้ login → เด้ง /admin/login) */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "";
  const step: FlowStep | "all" = FLOW_STEPS.includes(statusParam as FlowStep)
    ? (statusParam as FlowStep)
    : "all";
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : undefined;
  const to = toStr ? new Date(`${toStr}T23:59:59.999`) : undefined; // รวมทั้งวันสุดท้าย

  const orders = await ordersForExport({ from, to, step });

  const headers = [
    "เลขบิล", "วันที่สั่ง", "สถานะชำระ", "ชื่อผู้รับ", "เบอร์", "ที่อยู่", "รหัสไปรษณีย์",
    "สินค้า", "ยอดสินค้า", "ค่าส่ง", "ยอดรวม", "ประเภทชำระ", "ยอดที่โอน", "ขนส่ง", "เลขพัสดุ", "ส่งสำเร็จเมื่อ",
  ];
  const rows = orders.map((o) => {
    const subtotal = o.items.reduce((s, it) => s + it.qty * it.price, 0);
    return [
      o.orderNo,
      o.createdAt.toISOString().slice(0, 10),
      o.paymentStatus,
      o.shippingName,
      o.shippingPhone,
      o.shippingAddress,
      o.shippingPostcode ?? "",
      o.items.map((it) => `${it.name} x${it.qty}`).join("; "),
      subtotal,
      o.shippingFee,
      subtotal + o.shippingFee,
      o.paymentType,
      o.paymentTransferredAmount,
      o.trackingCourier ?? "",
      o.trackingNo ?? "",
      o.deliveredAt ? o.deliveredAt.toISOString().slice(0, 10) : "",
    ];
  });

  const today = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
