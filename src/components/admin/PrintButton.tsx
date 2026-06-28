"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-xl border border-pinksoft bg-blush px-5 py-2.5 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98]"
    >
      🖨 พิมพ์ใบเสร็จ
    </button>
  );
}
