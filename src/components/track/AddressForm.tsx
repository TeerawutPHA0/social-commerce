"use client";

import { useState, useTransition } from "react";
import { submitAddress } from "@/app/track/actions";
import { Card } from "./Card";

const inputCls =
  "w-full rounded-xl border border-pinksoft bg-cream px-3 py-2 text-sm text-brown outline-none focus:border-pink";

/** Step 1: ลูกค้ากรอกที่อยู่จัดส่งเอง (ตามรูปอ้างอิง) */
export function AddressForm({
  token,
  initial,
}: {
  token: string;
  initial: { name: string; address: string; postcode: string; phone: string; email: string };
}) {
  const [d, setD] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof d, v: string) => setD((p) => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitAddress(token, d);
      if (res.error) setError(res.error);
    });
  }

  return (
    <Card title="📍 กรอกที่อยู่สำหรับจัดส่ง" className="border border-pinksoft">
      <p className="-mt-2 mb-3 text-xs text-brown/60">
        สำคัญมาก! อย่าลืมใส่ที่อยู่นะคะ เพื่อให้ร้านจัดส่งได้ถูกต้อง
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <label className="block">
          <span className="mb-1 block text-xs text-brown/60">ชื่อผู้รับ *</span>
          <input className={inputCls} value={d.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-brown/60">ที่อยู่ผู้รับ *</span>
          <textarea
            className={inputCls + " min-h-24"}
            value={d.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="บ้านเลขที่ / หมู่บ้าน / ถนน / ตำบล / อำเภอ / จังหวัด"
          />
        </label>
        <div className="flex gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-xs text-brown/60">รหัสไปรษณีย์ *</span>
            <input
              className={inputCls}
              inputMode="numeric"
              maxLength={5}
              value={d.postcode}
              onChange={(e) => set("postcode", e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="block flex-1">
            <span className="mb-1 block text-xs text-brown/60">เบอร์โทรศัพท์ *</span>
            <input
              className={inputCls}
              inputMode="tel"
              value={d.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-brown/60">อีเมล (ถ้ามี)</span>
          <input
            className={inputCls}
            type="email"
            value={d.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-pinkdeep">⚠️ {error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="mt-1 rounded-xl border border-pinksoft bg-blush py-3 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกที่อยู่"}
        </button>
      </form>
    </Card>
  );
}
