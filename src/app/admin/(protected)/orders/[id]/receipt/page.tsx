import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderById, formatTHB, formatDateTime, courierLabel } from "@/lib/orders";
import { PrintButton } from "@/components/admin/PrintButton";
import type { Courier } from "@/types/order";

const PAY_LABEL: Record<string, string> = { unpaid: "ยังไม่ชำระ", pending: "รอตรวจสอบ", paid: "ชำระแล้ว" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrderById(id);
  if (!o) notFound();

  const subtotal = o.items.reduce((s, it) => s + it.qty * it.price, 0);
  const total = Math.max(0, subtotal + o.shippingFee - o.discount);
  const isDeposit = o.paymentType === "deposit";

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-center justify-between gap-2">
        <Link href={`/admin/orders/${o.id}`} className="text-sm text-brown/60">
          ← กลับ
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-pinksoft bg-white p-6 text-brown shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
        <div className="border-b border-pinksoft pb-3 text-center">
          <h1 className="text-lg font-bold">{o.storeName}</h1>
          <p className="mt-1 text-xs text-brown/50">ใบเสร็จรับเงิน / สรุปคำสั่งซื้อ</p>
        </div>

        <div className="flex justify-between py-3 text-sm">
          <div>
            <p className="font-semibold">เลขที่บิล {o.orderNo}</p>
            <p className="text-xs text-brown/50">{formatDateTime(o.createdAt.toISOString())}</p>
          </div>
          <span className="self-start rounded-full bg-pinksoft px-2 py-0.5 text-[11px] font-medium">
            {PAY_LABEL[o.paymentStatus] ?? o.paymentStatus}
          </span>
        </div>

        <div className="border-t border-pinksoft py-3 text-sm">
          <p className="font-medium">ผู้รับ</p>
          <p className="text-brown/80">{o.shippingName} · {o.shippingPhone}</p>
          <p className="text-brown/80">
            {o.shippingAddress} {o.shippingPostcode ?? ""}
          </p>
        </div>

        <table className="w-full border-t border-pinksoft py-2 text-sm">
          <thead>
            <tr className="text-left text-xs text-brown/50">
              <th className="py-1 font-normal">รายการ</th>
              <th className="py-1 text-center font-normal">จำนวน</th>
              <th className="py-1 text-right font-normal">รวม</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => (
              <tr key={i}>
                <td className="py-1">{it.name}</td>
                <td className="py-1 text-center">{it.qty}</td>
                <td className="py-1 text-right">฿{formatTHB(it.qty * it.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-pinksoft pt-3 text-sm">
          <Row label="ยอดสินค้า" value={`฿${formatTHB(subtotal)}`} />
          <Row label="ค่าส่ง" value={`฿${formatTHB(o.shippingFee)}`} />
          {o.discount > 0 && <Row label="ส่วนลด" value={`−฿${formatTHB(o.discount)}`} />}
          <Row label="ยอดรวมทั้งสิ้น" value={`฿${formatTHB(total)}`} bold />
          {isDeposit && (
            <>
              <Row label="มัดจำ" value={`฿${formatTHB(o.depositAmount)}`} />
              <Row label="คงเหลือ" value={`฿${formatTHB(Math.max(0, total - o.depositAmount))}`} />
            </>
          )}
          {o.paymentTransferredAmount > 0 && (
            <Row label="ยอดที่ชำระแล้ว" value={`฿${formatTHB(o.paymentTransferredAmount)}`} />
          )}
        </div>

        {o.trackingCourier && o.trackingNo && (
          <div className="border-t border-pinksoft pt-3 text-sm">
            <Row label={courierLabel(o.trackingCourier as Courier)} value={o.trackingNo} />
          </div>
        )}

        <p className="mt-4 text-center text-xs text-brown/40">ขอบคุณที่อุดหนุนค่ะ 💗</p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? "font-bold" : "text-brown/80"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
