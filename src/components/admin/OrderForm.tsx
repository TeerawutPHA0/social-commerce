"use client";

import { useState, useTransition } from "react";
import type {
  Courier,
  OrderFormInput,
  OrderStatus,
  PaymentStatus,
  PaymentType,
} from "@/types/order";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { COURIER_LABELS, PAYMENT_LABELS } from "@/lib/labels";
import { createOrder, updateOrder } from "@/app/admin/actions";

type ItemRow = { name: string; qty: string; price: string };

type FormState = {
  storeName: string;
  storeLogo: string;
  status: OrderStatus;
  shippingFee: string;
  discount: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingPostcode: string;
  shippingEmail: string;
  paymentType: PaymentType;
  depositAmount: string;
  paymentStatus: PaymentStatus;
  paymentTransferredAmount: string;
  paymentTransferredAt: string; // datetime-local
  trackingCourier: "" | Courier;
  trackingNo: string;
  note: string;
  items: ItemRow[];
};

/** ISO → ค่า datetime-local "YYYY-MM-DDTHH:mm" (เวลาเครื่อง) */
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function OrderForm({
  mode,
  orderId,
  initial,
  products = [],
}: {
  mode: "create" | "edit";
  orderId?: string;
  initial: OrderFormInput;
  /** แคตตาล็อกสินค้าไว้เลือกจาก dropdown */
  products?: Product[];
}) {
  const [f, setF] = useState<FormState>({
    storeName: initial.storeName,
    storeLogo: initial.storeLogo,
    status: initial.status,
    shippingFee: String(initial.shippingFee),
    discount: String(initial.discount),
    shippingName: initial.shippingName,
    shippingPhone: initial.shippingPhone,
    shippingAddress: initial.shippingAddress,
    shippingPostcode: initial.shippingPostcode ?? "",
    shippingEmail: initial.shippingEmail ?? "",
    paymentType: initial.paymentType,
    depositAmount: String(initial.depositAmount),
    paymentStatus: initial.paymentStatus,
    paymentTransferredAmount: String(initial.paymentTransferredAmount),
    paymentTransferredAt: isoToLocal(initial.paymentTransferredAt),
    trackingCourier: initial.trackingCourier ?? "",
    trackingNo: initial.trackingNo ?? "",
    note: initial.note ?? "",
    items:
      initial.items.length > 0
        ? initial.items.map((it) => ({
            name: it.name,
            qty: String(it.qty),
            price: String(it.price),
          }))
        : [{ name: "", qty: "1", price: "0" }],
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const setItem = (i: number, k: keyof ItemRow, v: string) =>
    setF((prev) => {
      const items = [...prev.items];
      items[i] = { ...items[i], [k]: v };
      return { ...prev, items };
    });

  const addItem = () =>
    setF((prev) => ({ ...prev, items: [...prev.items, { name: "", qty: "1", price: "0" }] }));

  /** แก้ชื่อสินค้า — ถ้าตรงกับสินค้าในแคตตาล็อก เติมราคาให้อัตโนมัติ */
  const setItemName = (i: number, value: string) =>
    setF((prev) => {
      const match = products.find((p) => p.name === value);
      const items = [...prev.items];
      items[i] = { ...items[i], name: value, ...(match ? { price: String(match.price) } : {}) };
      return { ...prev, items };
    });

  const removeItem = (i: number) =>
    setF((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));

  const total = Math.max(
    0,
    f.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0) +
      (Number(f.shippingFee) || 0) -
      (Number(f.discount) || 0)
  );

  function submit() {
    setError(null);
    if (f.items.every((it) => !it.name.trim())) {
      setError("กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    const input: OrderFormInput = {
      storeName: f.storeName,
      storeLogo: f.storeLogo,
      status: f.status,
      shippingFee: Number(f.shippingFee) || 0,
      discount: Number(f.discount) || 0,
      shippingName: f.shippingName,
      shippingPhone: f.shippingPhone,
      shippingAddress: f.shippingAddress,
      shippingPostcode: f.shippingPostcode.trim() || null,
      shippingEmail: f.shippingEmail.trim() || null,
      paymentType: f.paymentType,
      depositAmount: f.paymentType === "deposit" ? Number(f.depositAmount) || 0 : 0,
      paymentStatus: f.paymentStatus,
      paymentTransferredAmount: Number(f.paymentTransferredAmount) || 0,
      paymentTransferredAt: f.paymentTransferredAt
        ? new Date(f.paymentTransferredAt).toISOString()
        : null,
      trackingCourier: f.trackingCourier === "" ? null : f.trackingCourier,
      trackingNo: f.trackingNo.trim() || null,
      note: f.note.trim() || null,
      items: f.items.map((it) => ({
        name: it.name,
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0,
      })),
    };

    startTransition(async () => {
      try {
        if (mode === "create") await createOrder(input);
        else await updateOrder(orderId!, input);
      } catch (e) {
        // redirect ของ Next จะ throw — ไม่ถือเป็น error จริง
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
        setError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5"
    >
      <p className="rounded-xl border border-pinksoft bg-white px-4 py-2 text-xs text-brown/60">
        สถานะออเดอร์เลื่อนอัตโนมัติตาม flow — ลูกค้ากรอกที่อยู่ → ชำระเงิน → ร้านยืนยันสลิป → ใส่เลขพัสดุ
      </p>

      {/* รายการสินค้า */}
      <Section title="รายการสินค้า">
        {products.length === 0 ? (
          <p className="-mt-1 text-xs text-brown/50">
            อยากเลือกสินค้าจาก dropdown?{" "}
            <Link href="/admin/products" className="font-medium text-pinkdeep underline">
              บันทึกสินค้าไว้ก่อนที่นี่
            </Link>
          </p>
        ) : (
          <p className="-mt-1 text-xs text-brown/50">
            เลือกจากสินค้าที่บันทึกไว้ หรือพิมพ์ชื่อ/ราคาเองก็ได้
          </p>
        )}

        {/* ตัวเลือกสินค้าจากแคตตาล็อก — แสดงเป็น dropdown ในช่องชื่อ (พิมพ์เองก็ได้) */}
        <datalist id="catalog-products">
          {products.map((p) => (
            <option key={p.id} value={p.name}>
              ฿{p.price.toLocaleString("th-TH")}
            </option>
          ))}
        </datalist>

        <div className="flex flex-col gap-2">
          {f.items.map((it, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                list="catalog-products"
                className={inputBase + " min-w-0 flex-1"}
                placeholder={products.length > 0 ? "ชื่อสินค้า (พิมพ์หรือเลือก ▾)" : "ชื่อสินค้า"}
                value={it.name}
                onChange={(e) => setItemName(i, e.target.value)}
              />
              <input
                className={inputBase + " w-14 shrink-0 text-center"}
                type="number"
                min={1}
                placeholder="จำนวน"
                value={it.qty}
                onChange={(e) => setItem(i, "qty", e.target.value)}
              />
              <input
                className={inputBase + " w-24 shrink-0 text-right"}
                type="number"
                min={0}
                step="0.01"
                placeholder="ราคา"
                value={it.price}
                onChange={(e) => setItem(i, "price", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={f.items.length === 1}
                className="mt-2 text-pinkdeep disabled:opacity-30"
                aria-label="ลบรายการ"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 rounded-lg border border-pinksoft px-3 py-1.5 text-xs font-medium text-brown"
        >
          + เพิ่มสินค้า
        </button>
      </Section>

      {/* ค่าส่ง + ยอดรวม */}
      <Section title="ยอดเงิน">
        <Field label="ค่าส่ง (บาท) — 0 = ส่งฟรี">
          <input
            className={inputCls}
            type="number"
            min={0}
            step="0.01"
            value={f.shippingFee}
            onChange={(e) => set("shippingFee", e.target.value)}
          />
        </Field>

        <Field label="ส่วนลด (บาท) — หักจากยอดรวม">
          <input
            className={inputCls}
            type="number"
            min={0}
            step="0.01"
            value={f.discount}
            onChange={(e) => set("discount", e.target.value)}
          />
        </Field>

        <Select
          label="ประเภทการชำระเงิน"
          value={f.paymentType}
          onChange={(v) => set("paymentType", v as PaymentType)}
          options={[
            ["full", "จ่ายเต็มจำนวน"],
            ["deposit", "มัดจำ (จ่ายบางส่วน)"],
          ]}
        />

        {f.paymentType === "deposit" && (
          <Field label="ยอดมัดจำที่ลูกค้าต้องโอน (บาท)">
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.01"
              value={f.depositAmount}
              onChange={(e) => set("depositAmount", e.target.value)}
            />
          </Field>
        )}

        <div className="text-sm text-brown/70">
          <p>
            ยอดรวมทั้งสิ้น:{" "}
            <span className="font-bold text-brown">
              ฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </span>
          </p>
          {f.paymentType === "deposit" && (
            <p className="mt-0.5 text-xs text-pinkdeep">
              ลูกค้าจ่ายมัดจำ ฿
              {(Number(f.depositAmount) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}{" "}
              · คงเหลือ ฿
              {Math.max(0, total - (Number(f.depositAmount) || 0)).toLocaleString("th-TH", {
                minimumFractionDigits: 2,
              })}{" "}
              (เก็บภายหลัง/ปลายทาง)
            </p>
          )}
        </div>
      </Section>

      {/* ที่อยู่จัดส่ง */}
      <Section title="ที่อยู่สำหรับจัดส่ง">
        <p className="-mt-1 text-xs text-brown/50">
          เว้นว่างได้ — ลูกค้าจะกรอกเองผ่านลิงก์บิล
        </p>
        <Field label="ชื่อผู้รับ">
          <input className={inputCls} value={f.shippingName} onChange={(e) => set("shippingName", e.target.value)} />
        </Field>
        <Field label="เบอร์โทรศัพท์">
          <input className={inputCls} value={f.shippingPhone} onChange={(e) => set("shippingPhone", e.target.value)} />
        </Field>
        <Field label="ที่อยู่">
          <textarea
            className={inputCls + " min-h-20"}
            value={f.shippingAddress}
            onChange={(e) => set("shippingAddress", e.target.value)}
          />
        </Field>
        <div className="flex gap-3">
          <div className="flex-1">
            <Field label="รหัสไปรษณีย์">
              <input
                className={inputCls}
                inputMode="numeric"
                maxLength={5}
                value={f.shippingPostcode}
                onChange={(e) => set("shippingPostcode", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="อีเมล">
              <input
                className={inputCls}
                type="email"
                value={f.shippingEmail}
                onChange={(e) => set("shippingEmail", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* การชำระเงิน */}
      <Section title="การชำระเงิน">
        <Select
          label="สถานะการชำระเงิน"
          value={f.paymentStatus}
          onChange={(v) => set("paymentStatus", v as PaymentStatus)}
          options={Object.entries(PAYMENT_LABELS)}
        />
        <Field label="จำนวนเงินที่โอน (บาท)">
          <input
            className={inputCls}
            type="number"
            min={0}
            step="0.01"
            value={f.paymentTransferredAmount}
            onChange={(e) => set("paymentTransferredAmount", e.target.value)}
          />
        </Field>
        <Field label="วัน/เวลาที่โอน">
          <input
            className={inputCls}
            type="datetime-local"
            value={f.paymentTransferredAt}
            onChange={(e) => set("paymentTransferredAt", e.target.value)}
          />
        </Field>
      </Section>

      {/* เลขพัสดุ */}
      <Section title="เลขพัสดุ (กรอกเมื่อจัดส่งแล้ว)">
        <Select
          label="ขนส่ง"
          value={f.trackingCourier}
          onChange={(v) => set("trackingCourier", v as "" | Courier)}
          options={[["", "— ยังไม่มี —"], ...Object.entries(COURIER_LABELS)]}
        />
        <Field label="เลขพัสดุ">
          <input className={inputCls} value={f.trackingNo} onChange={(e) => set("trackingNo", e.target.value)} />
        </Field>
      </Section>

      {/* หมายเหตุ */}
      <Section title="ข้อมูลจากร้าน (หมายเหตุ)">
        <textarea
          className={inputCls + " min-h-20"}
          value={f.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="เช่น รอบจัดส่ง / ขอบคุณค่ะ"
        />
      </Section>

      {error && <p className="text-sm text-pinkdeep">⚠️ {error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="sticky bottom-4 rounded-xl border border-pinksoft bg-blush py-3 text-sm font-semibold text-brown shadow-[0_2px_10px_rgba(86,62,50,0.1)] transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : mode === "create" ? "สร้างออเดอร์" : "บันทึกการแก้ไข"}
      </button>
    </form>
  );
}

/* ---------- ชิ้นส่วน UI ย่อย ---------- */

// base (ไม่มี w-full) ใช้กับ input ในแถวรายการสินค้าที่ต้องคุมความกว้างเอง
const inputBase =
  "rounded-xl border border-pinksoft bg-cream px-3 py-2 text-sm text-brown outline-none focus:border-pink";
const inputCls = `w-full ${inputBase}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <h2 className="mb-3 text-sm font-semibold text-brown">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-brown/60">{label}</span>
      {children}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Field label={label}>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([val, lbl]) => (
          <option key={val} value={val}>
            {lbl}
          </option>
        ))}
      </select>
    </Field>
  );
}
