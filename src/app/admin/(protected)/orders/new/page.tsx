import Link from "next/link";
import type { OrderFormInput } from "@/types/order";
import { listProducts } from "@/lib/products";
import { getStoreSettings } from "@/lib/settings";
import { OrderForm } from "@/components/admin/OrderForm";

export default async function NewOrderPage() {
  const [products, store] = await Promise.all([listProducts(), getStoreSettings()]);

  // ค่าตั้งต้นออเดอร์ใหม่ — ดึงชื่อร้าน/โลโก้/ค่าส่งจากค่าตั้งร้าน
  const empty: OrderFormInput = {
    storeName: store.name,
    storeLogo: store.logo,
    status: "received",
    shippingFee: store.defaultShippingFee,
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm text-brown/60">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-brown">สร้างออเดอร์ใหม่</h1>
      </div>
      <OrderForm mode="create" initial={empty} products={products} />
    </div>
  );
}
