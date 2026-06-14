"use client";

import { useEffect, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

/** กล่องสำหรับเจ้าของร้าน — คัดลอกลิงก์ + ข้อความพร้อมส่งลูกค้าใน LINE/Facebook */
export function CopyOrderLink({ token, orderNo }: { token: string; orderNo: string }) {
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);

  // เริ่มด้วยค่าว่างให้ตรงกับฝั่ง server (กัน hydration mismatch) แล้วค่อยเติม origin หลัง mount
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/track/${token}`;

  const message =
    `เลขที่ใบสั่งซื้อ: ${orderNo}\n\n` +
    `🌸 กรอกที่อยู่ + ชำระเงิน + เช็คสถานะออเดอร์ได้ที่ลิงก์นี้เลยค่ะ\n` +
    `${url}\n\n` +
    `จัดส่งโดยไปรษณีย์ไทย EMS ✨💗 ขอบคุณมากค่ะ 💗✨`;

  async function copy(text: string, which: "link" | "msg") {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } else {
      setCopied(null);
      alert("คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ข้อความเพื่อคัดลอกเองได้ค่ะ");
    }
  }

  return (
    <div className="rounded-2xl border border-pinksoft bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <p className="text-sm font-semibold text-brown">ส่งให้ลูกค้า</p>
      <p className="mt-1 text-xs text-brown/50">
        เลขที่ใบสั่งซื้อ <span className="font-semibold text-brown">{orderNo}</span>
      </p>

      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-cream p-3 text-xs leading-relaxed text-brown">
        {message}
      </pre>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => copy(message, "msg")}
          className="flex-1 rounded-xl border border-pinksoft bg-blush py-2.5 text-sm font-semibold text-brown transition active:scale-95"
        >
          {copied === "msg" ? "คัดลอกข้อความแล้ว ✓" : "คัดลอกข้อความ"}
        </button>
        <button
          type="button"
          onClick={() => copy(url, "link")}
          className="rounded-xl border border-pinksoft px-3 py-2.5 text-sm font-medium text-brown transition active:scale-95"
        >
          {copied === "link" ? "✓" : "คัดลอกลิงก์"}
        </button>
      </div>
    </div>
  );
}
