"use client";

import { useState, useTransition } from "react";
import { checkTracking } from "@/app/admin/actions";

/**
 * ปุ่มเช็คสถานะพัสดุอัตโนมัติกับขนส่ง (ตาม courier ของออเดอร์)
 * - ถ้านำจ่ายสำเร็จ server จะ set deliveredAt ให้เอง (refresh ผ่าน revalidate)
 * - ถ้ายังไม่ได้ตั้งค่า credentials ของเจ้านั้น ปุ่มจะปิด + ขึ้นข้อความบอก
 */
export function CheckTrackingButton({
  id,
  courierLabel,
  configured,
}: {
  id: string;
  courierLabel: string;
  configured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "warn" | "err">("ok");

  function check() {
    setMsg(null);
    startTransition(async () => {
      const r = await checkTracking(id);
      if (!r.ok) {
        setTone("err");
        setMsg(r.error ?? "เช็คสถานะไม่สำเร็จ");
        return;
      }
      if (r.delivered) {
        setTone("ok");
        setMsg(`✅ นำจ่ายสำเร็จแล้ว — อัปเดตเป็น "จัดส่งสำเร็จ" ให้อัตโนมัติ${r.date ? ` (${r.date})` : ""}`);
      } else {
        setTone("warn");
        setMsg(`📦 สถานะล่าสุด: ${r.description ?? "กำลังขนส่ง"}`);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-pinksoft bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brown">เช็คสถานะกับ{courierLabel}</p>
          <p className="mt-0.5 text-xs text-brown/60">
            ดึงสถานะพัสดุจริง — ถ้านำจ่ายสำเร็จจะเลื่อนเป็น “จัดส่งสำเร็จ” ให้เอง
          </p>
        </div>
        <button
          type="button"
          disabled={pending || !configured}
          onClick={check}
          className="shrink-0 rounded-xl bg-brown px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-40"
        >
          {pending ? "กำลังเช็ค…" : "เช็คสถานะ"}
        </button>
      </div>

      {!configured && (
        <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs text-pinkdeep">
          ยังไม่ได้ตั้งค่า API ของ{courierLabel} — ใส่ credentials ใน .env ก่อนใช้งาน
        </p>
      )}

      {msg && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            tone === "ok"
              ? "bg-bluesoft/40 text-brown"
              : tone === "warn"
                ? "bg-blush text-brown"
                : "bg-pinksoft/40 text-pinkdeep"
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
