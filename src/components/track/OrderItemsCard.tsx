import type { Order } from "@/types/order";
import { Card } from "./Card";
import { formatTHB, itemsSubtotal, orderTotal } from "@/lib/orders";

/** รายการสินค้า + สรุปยอด (ค่าส่ง + ยอดรวม) */
export function OrderItemsCard({ order }: { order: Order }) {
  const subtotal = itemsSubtotal(order);
  const total = orderTotal(order);
  const freeShipping = order.shippingFee === 0;

  return (
    <Card title="รายการที่สั่งซื้อ">
      {/* หัวตาราง */}
      <div className="flex border-b border-pinksoft pb-2 text-xs font-medium text-brown/50">
        <span className="flex-1">ชื่อสินค้า</span>
        <span className="w-12 text-center">จำนวน</span>
        <span className="w-24 text-right">ราคา</span>
      </div>

      {/* แถวสินค้า */}
      <ul>
        {order.items.map((item, i) => (
          <li
            key={i}
            className="flex items-start border-b border-pinksoft/60 py-3 text-sm"
          >
            <span className="flex-1 pr-2 text-brown">{item.name}</span>
            <span className="w-12 text-center text-brown/70">{item.qty}</span>
            <span className="w-24 text-right text-brown">
              {formatTHB(item.qty * item.price)}
            </span>
          </li>
        ))}
      </ul>

      {/* สรุปยอด */}
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between text-brown/70">
          <dt>ยอดรวมสินค้า</dt>
          <dd>{formatTHB(subtotal)}</dd>
        </div>
        <div className="flex justify-between text-brown/70">
          <dt>ค่าส่ง EMS</dt>
          <dd className={freeShipping ? "font-medium text-brown" : ""}>
            {freeShipping ? "ฟรี" : formatTHB(order.shippingFee)}
          </dd>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-pinkdeep">
            <dt>ส่วนลด</dt>
            <dd>−{formatTHB(order.discount)}</dd>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between border-t border-pinksoft pt-3">
          <dt className="font-semibold text-brown">ยอดรวมทั้งสิ้น</dt>
          <dd className="text-lg font-bold text-brown">฿{formatTHB(total)}</dd>
        </div>
      </dl>
    </Card>
  );
}
