import Link from "next/link";
import type { FlowStep } from "@/lib/orders";
import {
  getStats,
  getMonthlySales,
  listOrders,
  formatTHB,
  deriveStep,
  dbAddressComplete,
  FLOW_STEPS,
  FLOW_LABELS,
} from "@/lib/orders";
import { DeleteOrderButton } from "@/components/admin/DeleteOrderButton";
import { CopyOrderLink } from "@/components/admin/CopyOrderLink";
import { MonthlySalesCard } from "@/components/admin/MonthlySalesCard";

const FLOW_BADGE: Record<FlowStep, string> = {
  address: "bg-pinksoft text-brown",
  payment: "bg-blush text-brown border border-pinksoft",
  verifying: "bg-blush text-pinkdeep border border-pinksoft",
  to_ship: "bg-bluesoft/40 text-brown border border-pinksoft",
  shipping: "bg-bluesoft/60 text-brown",
  delivered: "bg-brown text-white",
};

/** สร้าง URL /admin โดยคงค่า filter/ค้นหา/หน้า เท่าที่จำเป็น */
function hrefFor({ status, q, page }: { status?: string; q?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (status && status !== "all") sp.set("status", status);
  if (q) sp.set("q", q);
  if (page && page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `/admin?${s}` : "/admin";
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    no?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const { created, no, status, q: qRaw, page: pageRaw } = await searchParams;
  const q = qRaw?.trim() || "";
  const activeFilter = FLOW_STEPS.includes(status as FlowStep) ? (status as FlowStep) : "all";
  const page = Math.max(1, Number(pageRaw) || 1);

  const [stats, list, monthlySales] = await Promise.all([
    getStats(),
    listOrders({ step: activeFilter, q, page }),
    getMonthlySales(6),
  ]);
  const { orders, total, pageSize } = list;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      {created && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-brown">✅ สร้างออเดอร์แล้ว — ส่งให้ลูกค้าได้เลย</p>
          <CopyOrderLink token={created} orderNo={no ?? ""} />
        </div>
      )}

      {/* สถิติ */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="ออเดอร์ทั้งหมด" value={String(stats.totalOrders)} />
        <Stat label="ยอดขาย (ชำระแล้ว)" value={`฿${formatTHB(stats.revenue)}`} highlight />
        <Stat label="รอตรวจสลิป" value={String(stats.byStep.verifying)} />
        <Stat label="ที่ต้องจัดส่ง" value={String(stats.byStep.to_ship)} />
      </section>

      {/* กราฟยอดขายรายเดือน */}
      <MonthlySalesCard data={monthlySales} />

      {/* หัวข้อ + ปุ่มสร้าง */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-brown">ออเดอร์ ({total})</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products"
            className="rounded-xl border border-pinksoft bg-white px-4 py-2 text-sm font-semibold text-brown shadow-sm transition active:scale-95"
          >
            จัดการสินค้า
          </Link>
          <Link
            href="/admin/orders/new"
            className="rounded-xl border border-pinksoft bg-blush px-4 py-2 text-sm font-semibold text-brown shadow-sm transition active:scale-95"
          >
            + สร้างออเดอร์
          </Link>
        </div>
      </div>

      {/* ค้นหา (เลขบิล / ชื่อ / เบอร์โทร) — GET form คงค่า filter ปัจจุบัน */}
      <form action="/admin" method="get" className="flex gap-2">
        {activeFilter !== "all" && <input type="hidden" name="status" value={activeFilter} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาเลขบิล / ชื่อ / เบอร์โทร"
          className="min-w-0 flex-1 rounded-xl border border-pinksoft bg-white px-4 py-2 text-sm text-brown outline-none focus:border-pink"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl border border-pinksoft bg-blush px-4 py-2 text-sm font-semibold text-brown shadow-sm transition active:scale-95"
        >
          ค้นหา
        </button>
        {q && (
          <Link
            href={hrefFor({ status: activeFilter })}
            className="flex shrink-0 items-center rounded-xl border border-pinksoft bg-white px-3 py-2 text-sm text-brown/70 transition active:scale-95"
          >
            ล้าง
          </Link>
        )}
      </form>

      {/* ฟิลเตอร์สถานะ */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip
          label="ทั้งหมด"
          count={stats.totalOrders}
          href={hrefFor({ status: "all", q })}
          active={activeFilter === "all"}
        />
        {FLOW_STEPS.map((s) => (
          <FilterChip
            key={s}
            label={FLOW_LABELS[s]}
            count={stats.byStep[s]}
            href={hrefFor({ status: s, q })}
            active={activeFilter === s}
          />
        ))}
      </div>

      {/* รายการ */}
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-brown/50">
          {stats.totalOrders === 0
            ? "ยังไม่มีออเดอร์ — กด “สร้างออเดอร์” เพื่อเริ่ม"
            : q
              ? `ไม่พบออเดอร์ที่ตรงกับ “${q}”`
              : "ไม่มีออเดอร์ในสถานะนี้"}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => {
            const total = o.items.reduce((s, it) => s + it.qty * it.price, 0) + o.shippingFee;
            const step = deriveStep(
              dbAddressComplete(o),
              o.paymentStatus,
              !!o.trackingNo,
              !!o.deliveredAt
            );
            return (
              <li
                key={o.id}
                className="rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-brown">{o.orderNo}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FLOW_BADGE[step]}`}
                      >
                        {FLOW_LABELS[step]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-brown/70">
                      {o.shippingName} · {o.shippingPhone}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-brown">฿{formatTHB(total)}</span>
                </div>

                <div className="mt-3 flex items-center gap-3 border-t border-pinksoft/60 pt-3 text-xs">
                  <Link href={`/track/${o.token}`} target="_blank" className="font-medium text-brown underline">
                    เปิดบิล
                  </Link>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-brown">
                    แก้ไข
                  </Link>
                  <span className="flex-1" />
                  <DeleteOrderButton id={o.id} orderNo={o.orderNo} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* แบ่งหน้า */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-1 text-sm">
          <PageLink
            href={hrefFor({ status: activeFilter, q, page: page - 1 })}
            disabled={page <= 1}
            label="‹ ก่อนหน้า"
          />
          <span className="text-brown/60">
            หน้า {page} / {totalPages}
          </span>
          <PageLink
            href={hrefFor({ status: activeFilter, q, page: page + 1 })}
            disabled={page >= totalPages}
            label="ถัดไป ›"
          />
        </div>
      )}
    </div>
  );
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-pinksoft/50 px-3 py-1.5 font-medium text-brown/30">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-pinksoft bg-white px-3 py-1.5 font-medium text-brown shadow-sm transition active:scale-95"
    >
      {label}
    </Link>
  );
}

function FilterChip({
  label,
  count,
  href,
  active,
}: {
  label: string;
  count: number;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-brown text-white shadow-sm"
          : "border border-pinksoft bg-white text-brown/70"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] ${
          active ? "bg-white/25 text-white" : "bg-pinksoft/40 text-brown"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <p className="text-xs text-brown/50">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-pinkdeep" : "text-brown"}`}>
        {value}
      </p>
    </div>
  );
}
