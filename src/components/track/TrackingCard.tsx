"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { Card } from "./Card";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "./icons";

/**
 * ส่วนเลขพัสดุ — แสดงเมื่อสถานะเป็น "จัดส่งแล้ว" ขึ้นไป
 * มีปุ่ม Copy เลขพัสดุ + ปุ่มลัดไปหน้าติดตามของขนส่ง
 *
 * รับค่าที่ compute มาแล้วจาก server (courierLabel, trackUrl)
 * เพื่อให้ client component นี้เบาที่สุด
 */
export function TrackingCard({
  trackingNo,
  courierLabel,
  trackUrl,
}: {
  trackingNo: string;
  courierLabel: string;
  trackUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (await copyToClipboard(trackingNo)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      setCopied(false);
      alert("คัดลอกอัตโนมัติไม่ได้ — กดค้างที่เลขพัสดุเพื่อคัดลอกเองได้ค่ะ");
    }
  }

  return (
    <Card title="ติดตามพัสดุ" className="border border-pinksoft">
      <p className="mb-1 text-xs text-brown/50">ขนส่งโดย {courierLabel}</p>

      {/* กล่องเลขพัสดุ + ปุ่ม copy */}
      <div className="flex items-center gap-2 rounded-xl bg-cream p-3">
        <span className="flex-1 select-all break-all font-mono text-base font-semibold tracking-wide text-brown">
          {trackingNo}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="คัดลอกเลขพัสดุ"
          className="flex items-center gap-1 rounded-lg border border-pinksoft bg-blush px-3 py-2 text-xs font-medium text-brown shadow-sm transition active:scale-95"
        >
          {copied ? (
            <>
              <CheckIcon className="h-4 w-4" /> คัดลอกแล้ว
            </>
          ) : (
            <>
              <CopyIcon className="h-4 w-4" /> คัดลอก
            </>
          )}
        </button>
      </div>

      {/* ปุ่มลัดไปหน้าติดตามของขนส่ง */}
      <a
        href={trackUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-pinksoft bg-blush py-3 text-sm font-semibold text-brown shadow-[0_2px_10px_rgba(86,62,50,0.1)] transition active:scale-[0.98]"
      >
        ตรวจสอบสถานะพัสดุ
        <ExternalLinkIcon className="h-4 w-4" />
      </a>
    </Card>
  );
}
