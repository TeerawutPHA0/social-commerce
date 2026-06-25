import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  courierLabel,
  courierTrackUrl,
  getOrderByToken,
  isAddressComplete,
  deriveStep,
  orderTotal,
  amountDue,
  formatTHB,
} from "@/lib/orders";
import { StoreHeader } from "@/components/track/StoreHeader";
import { StatusTimeline } from "@/components/track/StatusTimeline";
import { OrderItemsCard } from "@/components/track/OrderItemsCard";
import { ShippingInfoCard } from "@/components/track/ShippingInfoCard";
import { PaymentDetailsCard } from "@/components/track/PaymentDetailsCard";
import { TrackingCard } from "@/components/track/TrackingCard";
import { AddressForm } from "@/components/track/AddressForm";
import { PaymentSection } from "@/components/track/PaymentSection";
import { Card } from "@/components/track/Card";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) return { title: "ไม่พบออเดอร์" };
  return {
    title: `บิล ${order.orderNo} · ${order.store.name}`,
    description: `ติดตามสถานะออเดอร์ ${order.orderNo}`,
    robots: { index: false, follow: false }, // ลิงก์ลับ — ห้าม index
  };
}

export default async function TrackOrderPage({ params }: Props) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();

  const addressDone = isAddressComplete(order);
  const paid = order.payment.status === "paid";
  const hasTracking = !!order.tracking;
  const delivered = !!order.deliveredAt;
  const needPayment = addressDone && !paid; // unpaid หรือ pending
  const step = deriveStep(addressDone, order.payment.status, hasTracking, delivered);
  const total = orderTotal(order);
  const isDeposit = order.payment.type === "deposit";
  const dueAmount = amountDue(order.payment.type, order.payment.depositAmount, total);
  const remaining = Math.max(0, total - order.payment.depositAmount);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 pt-6 pb-12">
      <StoreHeader order={order} />
      <StatusTimeline step={step} />

      {/* Step 1: ที่อยู่ยังไม่ครบ → ให้ลูกค้ากรอกก่อน */}
      {!addressDone ? (
        <>
          <AddressForm
            token={token}
            initial={{
              name: order.shipping.name,
              address: order.shipping.address,
              postcode: order.shipping.postcode ?? "",
              phone: order.shipping.phone,
              email: order.shipping.email ?? "",
            }}
          />
          <OrderItemsCard order={order} />
          {order.note && (
            <Card title="ข้อมูลจากร้าน">
              <p className="text-sm leading-relaxed text-brown/80">{order.note}</p>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Step 2-3: ชำระเงิน (QR + อัพสลิป + รอตรวจ) */}
          {needPayment && (
            <PaymentSection
              token={token}
              status={order.payment.status}
              amountText={formatTHB(dueAmount)}
              isDeposit={isDeposit}
              totalText={formatTHB(total)}
              remainingText={formatTHB(remaining)}
              slipUrl={order.payment.slipUrl}
              pay={order.store.pay}
            />
          )}

          {/* Step 4: จ่ายแล้ว ยังไม่มีเลขพัสดุ → ที่ต้องจัดส่ง (ร้านกำลังจัดเตรียม) */}
          {paid && !hasTracking && (
            <Card title="✅ ชำระเงินแล้ว" className="border border-pinksoft">
              <p className="text-sm text-brown/70">
                ทางร้านกำลังจัดเตรียมและจัดส่งสินค้า เลขพัสดุจะขึ้นในหน้านี้เมื่อจัดส่งแล้วค่ะ 💗
              </p>
              {isDeposit && remaining > 0 && (
                <p className="mt-2 text-sm font-medium text-pinkdeep">
                  💰 ยอดคงเหลือ ฿{formatTHB(remaining)} ชำระปลายทาง/ตามที่ร้านแจ้งนะคะ
                </p>
              )}
            </Card>
          )}

          {/* Step 5-6: มีเลขพัสดุ (กำลังจัดส่ง / จัดส่งสำเร็จ) */}
          {hasTracking && order.tracking && (
            <>
              {delivered && (
                <Card title="🎉 จัดส่งสำเร็จแล้ว" className="border border-pinksoft">
                  <p className="text-sm text-brown/70">
                    พัสดุถึงผู้รับเรียบร้อยแล้ว ขอบคุณที่อุดหนุนนะคะ 💗
                  </p>
                </Card>
              )}
              <TrackingCard
                trackingNo={order.tracking.trackingNo}
                courierLabel={courierLabel(order.tracking.courier)}
                trackUrl={courierTrackUrl(order.tracking.courier, order.tracking.trackingNo)}
              />
            </>
          )}

          <OrderItemsCard order={order} />

          {order.note && (
            <Card title="ข้อมูลจากร้าน">
              <p className="text-sm leading-relaxed text-brown/80">{order.note}</p>
            </Card>
          )}

          <ShippingInfoCard order={order} />
          {paid && <PaymentDetailsCard order={order} />}
        </>
      )}

      <p className="pt-2 text-center text-xs text-brown/40">
        บิลนี้สร้างจากลิงก์เฉพาะของคุณ · ไม่ต้องเข้าสู่ระบบ
      </p>
    </main>
  );
}
