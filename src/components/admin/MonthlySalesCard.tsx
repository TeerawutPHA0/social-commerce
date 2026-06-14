import type { MonthlySales } from "@/lib/orders";
import { formatTHB } from "@/lib/orders";

/** ย่อจำนวนเงินให้สั้นบนแกนกราฟ: 12500 → "13k", 1200000 → "1.2M" */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return Math.round(n).toLocaleString("th-TH");
}

/** การ์ดกราฟแท่งยอดขายรายเดือน (server component — render ด้วย div ล้วน ไม่ง้อ chart lib) */
export function MonthlySalesCard({ data }: { data: MonthlySales[] }) {
  const max = Math.max(...data.map((m) => m.revenue), 0);
  const totalRevenue = data.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = data.reduce((s, m) => s + m.orders, 0);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-semibold text-brown">ยอดขายรายเดือน</h2>
          <p className="text-xs text-brown/50">ย้อนหลัง {data.length} เดือน · {totalOrders} ออเดอร์</p>
        </div>
        <p className="text-right">
          <span className="block text-[11px] text-brown/50">รวมทั้งหมด</span>
          <span className="text-lg font-bold text-pinkdeep">฿{formatTHB(totalRevenue)}</span>
        </p>
      </div>

      {max === 0 ? (
        <p className="py-8 text-center text-sm text-brown/40">ยังไม่มียอดขายในช่วงนี้</p>
      ) : (
        <div className="flex h-44 items-stretch gap-2">
          {data.map((m) => {
            const pct = max > 0 ? (m.revenue / max) * 100 : 0;
            return (
              <div key={m.key} className="flex flex-1 flex-col items-center">
                {/* พื้นที่แท่ง (โตจากล่างขึ้นบน) */}
                <div className="flex w-full flex-1 flex-col justify-end">
                  {m.revenue > 0 && (
                    <span className="mb-1 text-center text-[10px] font-medium text-brown/70">
                      {compact(m.revenue)}
                    </span>
                  )}
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-pink to-bluesoft transition-all"
                    style={{ height: `${Math.max(pct, m.revenue > 0 ? 4 : 0)}%` }}
                    title={`${m.label}: ฿${formatTHB(m.revenue)} (${m.orders} ออเดอร์)`}
                  />
                </div>
                <span className="mt-2 text-[10px] text-brown/50">{m.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
