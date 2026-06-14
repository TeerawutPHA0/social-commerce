import type { Order, PaymentStatus } from "@/types/order";
import { Card } from "./Card";
import { formatDateTime, formatTHB, orderTotal } from "@/lib/orders";

const PAYMENT_META: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: "ชำระเงินแล้ว", className: "bg-bluesoft/60 text-brown" },
  pending: { label: "รอตรวจสอบ", className: "bg-pinksoft text-brown" },
  unpaid: { label: "ยังไม่ชำระ", className: "bg-brown/10 text-brown/60" },
};

/** รายละเอียดการชำระเงิน: สถานะ + ประเภท + จำนวนเงินที่โอน + วัน/เวลาที่โอน */
export function PaymentDetailsCard({ order }: { order: Order }) {
  const { status, type, depositAmount, transferredAmount, transferredAt } = order.payment;
  const meta = PAYMENT_META[status];
  const isDeposit = type === "deposit";
  const remaining = Math.max(0, orderTotal(order) - depositAmount);

  return (
    <Card title="รายละเอียดการชำระเงิน">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-brown/70">สถานะการชำระเงิน</dt>
          <dd>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>
              {meta.label}
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-brown/70">ประเภทการชำระเงิน</dt>
          <dd className="font-medium text-brown">{isDeposit ? "มัดจำ" : "จ่ายเต็มจำนวน"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-brown/70">{isDeposit ? "ยอดมัดจำที่โอน" : "จำนวนเงินที่โอน"}</dt>
          <dd className="font-medium text-brown">฿{formatTHB(transferredAmount)}</dd>
        </div>
        {isDeposit && remaining > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-brown/70">ยอดคงเหลือ (ชำระภายหลัง)</dt>
            <dd className="font-medium text-pinkdeep">฿{formatTHB(remaining)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="text-brown/70">วัน / เวลาที่โอนเงิน</dt>
          <dd className="text-brown">
            {transferredAt ? formatDateTime(transferredAt) : "—"}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
