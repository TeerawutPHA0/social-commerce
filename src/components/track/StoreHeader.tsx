import Image from "next/image";
import type { Order } from "@/types/order";
import { formatDateTime } from "@/lib/orders";

/** หัวบิล: โลโก้ร้าน + ชื่อร้าน + เลขที่ใบสั่งซื้อ + วันที่สั่งซื้อ */
export function StoreHeader({ order }: { order: Order }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-2 pb-1 text-center">
      <div className="h-20 w-20 overflow-hidden rounded-full ring-4 ring-pinksoft">
        <Image
          src={order.store.logo}
          alt={order.store.name}
          width={80}
          height={80}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      <div>
        <p className="text-lg font-semibold text-brown">{order.store.name}</p>
        <p className="mt-1 text-sm text-brown/80">
          เลขที่ใบสั่งซื้อ <span className="font-semibold text-brown">{order.orderNo}</span>
        </p>
        <p className="text-xs text-brown/50">
          วันที่สั่งซื้อ {formatDateTime(order.createdAt)}
        </p>
      </div>
    </div>
  );
}
