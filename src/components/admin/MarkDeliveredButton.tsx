"use client";

import { useTransition } from "react";
import { markDelivered } from "@/app/admin/actions";

/** ปุ่มยืนยัน/ยกเลิก "จัดส่งสำเร็จ" สำหรับร้าน (แสดงเมื่อมีเลขพัสดุแล้ว) */
export function MarkDeliveredButton({ id, delivered }: { id: string; delivered: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-pinksoft bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brown">สถานะการจัดส่ง</p>
        <p className="mt-0.5 text-xs text-brown/60">
          {delivered ? "✅ ยืนยันแล้วว่าจัดส่งสำเร็จ" : "กำลังจัดส่ง — กดยืนยันเมื่อพัสดุถึงผู้รับแล้ว"}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => markDelivered(id, !delivered))}
        className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-95 disabled:opacity-50 ${
          delivered
            ? "border border-pinksoft bg-white text-pinkdeep"
            : "bg-brown text-white"
        }`}
      >
        {pending ? "กำลังบันทึก…" : delivered ? "ยกเลิกจัดส่งสำเร็จ" : "✓ ยืนยันจัดส่งสำเร็จ"}
      </button>
    </div>
  );
}
