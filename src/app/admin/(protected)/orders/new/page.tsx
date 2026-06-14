import Link from "next/link";
import type { OrderFormInput } from "@/types/order";
import { listProducts } from "@/lib/products";
import { OrderForm } from "@/components/admin/OrderForm";

const EMPTY: OrderFormInput = {
  storeName: "puffiepiece",
  storeLogo: "/logo.jpg",
  status: "received",
  shippingFee: 0,
  shippingName: "",
  shippingPhone: "",
  shippingAddress: "",
  shippingPostcode: null,
  shippingEmail: null,
  paymentType: "full",
  depositAmount: 0,
  paymentStatus: "unpaid",
  paymentTransferredAmount: 0,
  paymentTransferredAt: null,
  trackingCourier: null,
  trackingNo: null,
  note: null,
  items: [],
};

export default async function NewOrderPage() {
  const products = await listProducts();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm text-brown/60">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-brown">สร้างออเดอร์ใหม่</h1>
      </div>
      <OrderForm mode="create" initial={EMPTY} products={products} />
    </div>
  );
}
