"use client";

import { useState, useTransition } from "react";
import type { PaymentMethod } from "@/types/order";
import type { StoreSettings } from "@/lib/settings";
import { updateStoreSettings } from "@/app/admin/actions";

const inputBase =
  "rounded-xl border border-pinksoft bg-cream px-3 py-2 text-sm text-brown outline-none focus:border-pink";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-brown">{label}</span>
      {children}
      {hint && <span className="text-xs text-brown/50">{hint}</span>}
    </label>
  );
}

export function StoreSettingsForm({ initial }: { initial: StoreSettings }) {
  const [name, setName] = useState(initial.name);
  const [logo, setLogo] = useState(initial.logo);
  const [shippingFee, setShippingFee] = useState(String(initial.defaultShippingFee));
  const [accountName, setAccountName] = useState(initial.payAccountName);
  const [qrImage, setQrImage] = useState(initial.payQrImage);
  const [promptpayId, setPromptpayId] = useState(initial.promptpayId);
  const [warning, setWarning] = useState(initial.payWarning);
  const [legalName, setLegalName] = useState(initial.legalName);
  const [privacyContact, setPrivacyContact] = useState(initial.privacyContact);
  const [methods, setMethods] = useState<PaymentMethod[]>(
    initial.payMethods.length ? initial.payMethods : [{ label: "", value: "" }]
  );

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function setMethod(i: number, patch: Partial<PaymentMethod>) {
    setMethods((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function addMethod() {
    setMethods((prev) => [...prev, { label: "", value: "" }]);
  }
  function removeMethod(i: number) {
    setMethods((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateStoreSettings({
        name,
        logo,
        defaultShippingFee: Number(shippingFee) || 0,
        payAccountName: accountName,
        payQrImage: qrImage,
        promptpayId,
        payWarning: warning,
        payMethods: methods,
        legalName,
        privacyContact,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ข้อมูลร้าน */}
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
        <h2 className="text-sm font-semibold text-brown">ข้อมูลร้าน</h2>
        <Field label="ชื่อร้าน">
          <input className={inputBase} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="โลโก้ร้าน" hint="วาง URL รูปโลโก้ (เว้นว่าง = ใช้โลโก้ดีฟอลต์)">
          <input className={inputBase} value={logo} onChange={(e) => setLogo(e.target.value)} />
        </Field>
        <Field label="ค่าส่งเริ่มต้น (บาท)" hint="ใช้เป็นค่าตั้งต้นตอนสร้างออเดอร์ใหม่">
          <input
            className={inputBase + " w-32 text-right"}
            type="number"
            min={0}
            step="0.01"
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value)}
          />
        </Field>
      </section>

      {/* ข้อมูลรับเงิน */}
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
        <h2 className="text-sm font-semibold text-brown">ข้อมูลรับเงิน (ลูกค้าเห็นตอนชำระเงิน)</h2>
        <Field label="ชื่อบัญชี / ชื่อผู้รับเงิน">
          <input
            className={inputBase}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </Field>
        <Field
          label="เลขพร้อมเพย์ (สร้าง QR อัตโนมัติตามยอดบิล)"
          hint="เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก — ลูกค้าสแกนแล้วยอดขึ้นเอง (แนะนำ)"
        >
          <input
            className={inputBase}
            inputMode="numeric"
            placeholder="เช่น 0812345678"
            value={promptpayId}
            onChange={(e) => setPromptpayId(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </Field>
        <Field label="รูป QR (สำรอง)" hint="ใช้เมื่อไม่ได้กรอกเลขพร้อมเพย์ — วาง URL รูป QR">
          <input className={inputBase} value={qrImage} onChange={(e) => setQrImage(e.target.value)} />
        </Field>

        {/* ช่องทางโอน (list) */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-brown">ช่องทางโอน</span>
          {methods.map((m, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-pinksoft/60 p-2 sm:flex-row sm:items-start">
              <input
                className={inputBase + " min-w-0 flex-1"}
                placeholder="ชื่อช่องทาง เช่น kbank (กสิกร)"
                value={m.label}
                onChange={(e) => setMethod(i, { label: e.target.value })}
              />
              <input
                className={inputBase + " min-w-0 flex-1"}
                placeholder="เลขบัญชี/เบอร์"
                value={m.value}
                onChange={(e) => setMethod(i, { value: e.target.value })}
              />
              <input
                className={inputBase + " min-w-0 flex-1"}
                placeholder="หมายเหตุ (ออปชัน)"
                value={m.note ?? ""}
                onChange={(e) => setMethod(i, { note: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeMethod(i)}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-pinkdeep transition active:scale-95"
              >
                ลบ
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMethod}
            className="self-start rounded-xl border border-pinksoft bg-white px-3 py-1.5 text-xs font-semibold text-brown transition active:scale-95"
          >
            + เพิ่มช่องทาง
          </button>
        </div>

        <Field label="ข้อความเตือนตอนโอน" hint="เช่น รบกวนเช็คเลขก่อนโอนนะคะ">
          <input className={inputBase} value={warning} onChange={(e) => setWarning(e.target.value)} />
        </Field>
      </section>

      {/* นโยบายความเป็นส่วนตัว (PDPA) */}
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-brown">นโยบายความเป็นส่วนตัว (PDPA)</h2>
          <p className="text-xs text-brown/50">
            ใช้เติมในหน้า{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              /privacy
            </a>{" "}
            ที่ลูกค้าเห็น — ตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล
          </p>
        </div>
        <Field
          label="ชื่อผู้ควบคุมข้อมูล / ชื่อกิจการ"
          hint="ชื่อนิติบุคคลหรือเจ้าของกิจการตามกฎหมาย (เว้นว่าง = ใช้ชื่อร้าน)"
        >
          <input
            className={inputBase}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
        </Field>
        <Field
          label="ช่องทางติดต่อเรื่องข้อมูลส่วนบุคคล"
          hint="อีเมล/เบอร์/LINE ที่ลูกค้าใช้ขอเข้าถึง/แก้ไข/ลบข้อมูลได้"
        >
          <input
            className={inputBase}
            value={privacyContact}
            onChange={(e) => setPrivacyContact(e.target.value)}
          />
        </Field>
      </section>

      {error && <p className="text-sm text-pinkdeep">⚠️ {error}</p>}
      {saved && <p className="text-sm text-brown">✅ บันทึกแล้ว</p>}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="self-start rounded-xl border border-pinksoft bg-blush px-5 py-2.5 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
      </button>
    </div>
  );
}
