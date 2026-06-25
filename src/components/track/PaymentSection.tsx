"use client";

import { useRef, useState, useTransition } from "react";
import type { PaymentStatus, StorePaymentInfo } from "@/types/order";
import { uploadSlip } from "@/app/track/actions";
import { Card } from "./Card";

/**
 * ย่อ+บีบอัดรูปสลิปฝั่ง browser ก่อนส่ง (กัน body เกินลิมิต Server Action)
 * - ย่อด้านที่ยาวสุดให้ไม่เกิน maxDim แล้ว encode เป็น JPEG
 * - ถ้า decode ไม่ได้ (เช่น HEIC บางเครื่อง) คืนไฟล์เดิม ให้ bodySizeLimit รับช่วงต่อ
 */
async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );
  if (!blob) return file;

  // ถ้าบีบแล้วไม่เล็กลง (เช่นไฟล์เล็กอยู่แล้ว) ใช้ไฟล์เดิม
  if (blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

/**
 * ชำระเงิน
 *  - unpaid  → QR + ข้อมูลบัญชี + อัพสลิป
 *  - pending → "รอร้านตรวจสอบ" + สลิป (อัพใหม่ได้)
 */
export function PaymentSection({
  token,
  status,
  amountText,
  isDeposit,
  totalText,
  remainingText,
  slipUrl,
  pay,
}: {
  token: string;
  status: PaymentStatus;
  /** ยอดที่ต้องโอนรอบนี้ (มัดจำ หรือ เต็มจำนวน) */
  amountText: string;
  isDeposit: boolean;
  /** ยอดเต็มทั้งบิล */
  totalText: string;
  /** ยอดคงเหลือหลังหักมัดจำ */
  remainingText: string;
  slipUrl: string | null;
  /** ข้อมูลรับเงินของร้าน (จาก settings) */
  pay: StorePaymentInfo;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submitSlip() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.set("token", token);
      fd.set("slip", compressed);
      const res = await uploadSlip(fd);
      if (res?.error) setError(res.error);
    });
  }

  const pendingState = status === "pending";

  return (
    <Card
      title={pendingState ? "⏳ กำลังตรวจสอบการชำระเงิน" : "💳 ชำระเงิน"}
      className="border border-pinksoft"
    >
      {pendingState ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-brown/70">
            ส่งสลิปเรียบร้อยแล้วค่ะ ทางร้านกำลังตรวจสอบ — สถานะจะอัปเดตในหน้านี้
          </p>
          {slipUrl && (
            <a href={slipUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slipUrl}
                alt="สลิปที่อัพโหลด"
                className="mx-auto max-h-72 w-auto rounded-xl border border-pinksoft object-contain"
              />
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm text-brown/70">
            𓂂 🌸 how to pay 𓂂 —{" "}
            {isDeposit ? "ยอดมัดจำ" : "ยอด"}{" "}
            <span className="font-bold text-brown">฿{amountText}</span>
          </p>
          {isDeposit && (
            <p className="-mt-1 text-center text-xs text-pinkdeep">
              ยอดเต็ม ฿{totalText} · คงเหลือ ฿{remainingText} (ชำระภายหลัง/ปลายทาง)
            </p>
          )}
          {pay.qrImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pay.qrImage}
              alt="QR ชำระเงิน"
              width={260}
              height={260}
              className="rounded-xl border border-pinksoft object-contain"
            />
          )}

          {/* ข้อมูลบัญชี */}
          {(pay.methods.length > 0 || pay.accountName) && (
            <div className="w-full rounded-xl bg-cream p-3 text-sm">
              {pay.methods.map((m, i) => (
                <div key={i} className="flex items-baseline justify-between py-1">
                  <span className="text-brown/70">♡ {m.label}</span>
                  <span className="text-right font-semibold text-brown">
                    {m.value}
                    {m.note && (
                      <span className="block text-[11px] font-normal text-pinkdeep">{m.note}</span>
                    )}
                  </span>
                </div>
              ))}
              {pay.accountName && (
                <p className="mt-2 border-t border-pinksoft pt-2 text-center font-medium text-brown">
                  💒 {pay.accountName}
                </p>
              )}
            </div>
          )}
          {pay.warning && (
            <p className="text-center text-xs text-pinkdeep">🌺 {pay.warning}</p>
          )}
        </div>
      )}

      {/* อัพโหลด/อัพใหม่ */}
      <div className="mt-4 flex flex-col gap-3 border-t border-pinksoft/60 pt-4">
        <p className="text-sm font-medium text-brown">
          {pendingState ? "อัพโหลดสลิปใหม่ (ถ้าต้องการ)" : "อัพโหลดสลิปการโอน"}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
          className="text-sm text-brown file:mr-3 file:rounded-lg file:border file:border-pinksoft file:bg-blush file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brown"
        />
        {preview && (
          <img
            src={preview}
            alt="ตัวอย่างสลิป"
            className="max-h-56 w-auto self-center rounded-xl border border-pinksoft object-contain"
          />
        )}
        {error && <p className="text-center text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={submitSlip}
          disabled={pending}
          className="rounded-xl border border-pinksoft bg-blush py-3 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "กำลังส่งสลิป…" : "ส่งสลิป"}
        </button>
      </div>
    </Card>
  );
}
