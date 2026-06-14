"use client";

import { useState, useTransition } from "react";
import type { Product } from "@/lib/products";
import { createProduct, updateProduct, deleteProduct } from "@/app/admin/actions";

// base ไม่มี w-full — กันชนกับ w-24/w-28 ที่ใส่ทีหลัง (Tailwind v4 generated order)
const inputBase =
  "rounded-xl border border-pinksoft bg-cream px-3 py-2 text-sm text-brown outline-none focus:border-pink";

export function ProductManager({ products }: { products: Product[] }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    if (!name.trim()) {
      setError("กรุณากรอกชื่อสินค้า");
      return;
    }
    startTransition(async () => {
      const res = await createProduct(name, Number(price) || 0);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setName("");
      setPrice("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ฟอร์มเพิ่มสินค้า */}
      <section className="rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
        <h2 className="mb-3 text-sm font-semibold text-brown">เพิ่มสินค้า</h2>
        <div className="flex items-start gap-2">
          <input
            className={inputBase + " min-w-0 flex-1"}
            placeholder="ชื่อสินค้า"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <input
            className={inputBase + " w-28 shrink-0 text-right"}
            type="number"
            min={0}
            step="0.01"
            placeholder="ราคา"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="shrink-0 rounded-xl border border-pinksoft bg-blush px-4 py-2 text-sm font-semibold text-brown shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            {pending ? "…" : "เพิ่ม"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-pinkdeep">⚠️ {error}</p>}
      </section>

      {/* รายการสินค้า */}
      {products.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-brown/50">
          ยังไม่มีสินค้า — เพิ่มสินค้าด้านบนเพื่อเริ่ม
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** แถวสินค้า 1 รายการ — สลับระหว่างโหมดแสดงผล กับ โหมดแก้ไข inline */
function ProductRow({ product }: { product: Product }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!name.trim()) {
      setError("กรุณากรอกชื่อสินค้า");
      return;
    }
    startTransition(async () => {
      const res = await updateProduct(product.id, name, Number(price) || 0);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
    });
  }

  function cancel() {
    setName(product.name);
    setPrice(String(product.price));
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
        <div className="flex items-start gap-2">
          <input
            className={inputBase + " min-w-0 flex-1"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            autoFocus
          />
          <input
            className={inputBase + " w-24 shrink-0 text-right"}
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        {error && <p className="mt-2 text-sm text-pinkdeep">⚠️ {error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="rounded-lg border border-pinksoft px-3 py-1.5 text-xs font-medium text-brown disabled:opacity-40"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-brown px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <span className="min-w-0 flex-1 truncate font-medium text-brown">{product.name}</span>
      <span className="shrink-0 text-brown/70">
        ฿{product.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-brown transition active:scale-95"
      >
        แก้ไข
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`ลบสินค้า "${product.name}"?`)) return;
          startTransition(() => deleteProduct(product.id));
        }}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-pinkdeep transition active:scale-95 disabled:opacity-40"
      >
        {pending ? "…" : "ลบ"}
      </button>
    </li>
  );
}
