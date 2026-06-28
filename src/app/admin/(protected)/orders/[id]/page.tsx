import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  Courier,
  OrderFormInput,
  OrderStatus,
  PaymentStatus,
  PaymentType,
} from "@/types/order";
import { getOrderById, orderTotal, formatTHB } from "@/lib/orders";
import { listProducts } from "@/lib/products";
import { OrderForm } from "@/components/admin/OrderForm";
import { SlipReview } from "@/components/admin/SlipReview";
import { CopyOrderLink } from "@/components/admin/CopyOrderLink";
import { MarkDeliveredButton } from "@/components/admin/MarkDeliveredButton";
import { CheckTrackingButton } from "@/components/admin/CheckTrackingButton";
import { isCourierConfigured } from "@/lib/couriers";
import { courierLabel } from "@/lib/orders";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [o, products] = await Promise.all([getOrderById(id), listProducts()]);
  if (!o) notFound();

  const initial: OrderFormInput = {
    storeName: o.storeName,
    storeLogo: o.storeLogo,
    status: o.status as OrderStatus,
    shippingFee: o.shippingFee,
    discount: o.discount,
    shippingName: o.shippingName,
    shippingPhone: o.shippingPhone,
    shippingAddress: o.shippingAddress,
    shippingPostcode: o.shippingPostcode ?? null,
    shippingEmail: o.shippingEmail ?? null,
    paymentType: o.paymentType as PaymentType,
    depositAmount: o.depositAmount,
    paymentStatus: o.paymentStatus as PaymentStatus,
    paymentTransferredAmount: o.paymentTransferredAmount,
    paymentTransferredAt: o.paymentTransferredAt?.toISOString() ?? null,
    trackingCourier: (o.trackingCourier as Courier | null) ?? null,
    trackingNo: o.trackingNo ?? null,
    note: o.note ?? null,
    items: o.items.map((it) => ({ name: it.name, qty: it.qty, price: it.price })),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm text-brown/60">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-brown">
          แก้ไขออเดอร์ {o.orderNo}
        </h1>
      </div>

      <CopyOrderLink token={o.token} orderNo={o.orderNo} />
      <Link
        href={`/track/${o.token}`}
        target="_blank"
        className="text-center text-xs text-brown/50 underline"
      >
        เปิดดูบิลแบบลูกค้า →
      </Link>

      {o.paymentSlipUrl && (
        <SlipReview
          id={o.id}
          slipUrl={o.paymentSlipUrl}
          status={o.paymentStatus as PaymentStatus}
          amountText={formatTHB(orderTotal({ items: o.items, shippingFee: o.shippingFee, discount: o.discount }))}
          verifyStatus={o.slipVerifyStatus as "verified" | "amount_mismatch" | "failed" | null}
          verifyNote={o.slipVerifyNote}
        />
      )}

      {/* ยืนยันจัดส่งสำเร็จ — แสดงเมื่อมีเลขพัสดุแล้ว (step กำลังจัดส่ง → จัดส่งสำเร็จ) */}
      {o.trackingNo && o.trackingCourier && (
        <>
          <CheckTrackingButton
            id={o.id}
            courierLabel={courierLabel(o.trackingCourier as Courier)}
            configured={isCourierConfigured(o.trackingCourier as Courier)}
          />
          <MarkDeliveredButton id={o.id} delivered={!!o.deliveredAt} />
        </>
      )}

      {/* key ผูกกับสถานะที่ verifyPayment เปลี่ยน — พอยืนยัน/ปฏิเสธสลิปแล้ว ฟอร์มจะ remount
          พร้อมค่าใหม่ ไม่ค้างค่าเก่า (กันการกดบันทึกแล้วทับสถานะ paid กลับเป็นยังไม่ชำระ) */}
      <OrderForm
        key={`${o.paymentStatus}-${o.paymentSlipUrl ?? ""}`}
        mode="edit"
        orderId={o.id}
        initial={initial}
        products={products}
      />
    </div>
  );
}
