"use client";

import { useTransition } from "react";
import { verifyPayment } from "@/app/admin/actions";
import { PAYMENT_LABELS } from "@/lib/labels";
import type { PaymentStatus } from "@/types/order";

/** กล่องตรวจสลิปในหน้าแก้ไข — แสดงรูปสลิป + ปุ่มยืนยัน/ปฏิเสธ */
export function SlipReview({
  id,
  slipUrl,
  status,
  amountText,
  verifyStatus,
  verifyNote,
}: {
  id: string;
  slipUrl: string;
  status: PaymentStatus;
  amountText: string;
  /** ผลตรวจสลิปอัตโนมัติ (null = ไม่ได้เปิดใช้/ยังไม่ตรวจ) */
  verifyStatus?: "verified" | "amount_mismatch" | "failed" | null;
  verifyNote?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  // สีกล่องผลตรวจ: เขียว = ผ่าน, เหลือง = ยอด/อ่านไม่ตรง (ร้านยังตัดสินใจเอง)
  const verifyTone =
    verifyStatus === "verified"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <section className="rounded-2xl border border-pinksoft bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brown">ตรวจสอบสลิป</h2>
        <span className="rounded-full bg-blush px-2 py-0.5 text-xs text-brown">
          {PAYMENT_LABELS[status]}
        </span>
      </div>

      <p className="mb-2 text-sm text-brown/70">ยอดที่ต้องชำระ: ฿{amountText}</p>

      {verifyStatus && verifyNote && (
        <p className={`mb-2 rounded-xl border px-3 py-2 text-xs ${verifyTone}`}>
          {verifyNote}
        </p>
      )}

      <a href={slipUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slipUrl}
          alt="สลิปการโอน"
          className="mx-auto max-h-80 w-auto rounded-xl border border-pinksoft object-contain"
        />
      </a>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          disabled={pending || status === "paid"}
          onClick={() => startTransition(() => verifyPayment(id, true))}
          className="flex-1 rounded-xl bg-brown py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
        >
          ✓ ยืนยันชำระเงิน
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("ปฏิเสธสลิปนี้? สถานะจะกลับเป็นยังไม่ชำระ และลบสลิป")) {
              startTransition(() => verifyPayment(id, false));
            }
          }}
          className="rounded-xl border border-pinksoft px-4 py-2.5 text-sm font-medium text-pinkdeep transition active:scale-95 disabled:opacity-40"
        >
          ปฏิเสธ
        </button>
      </div>
    </section>
  );
}
