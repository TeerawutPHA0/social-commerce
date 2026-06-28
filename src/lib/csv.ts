/** สร้างไฟล์ CSV (RFC-4180) พร้อม BOM ให้ Excel เปิดภาษาไทยไม่เพี้ยน */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const BOM = String.fromCharCode(0xfeff); // ให้ Excel รู้ว่าเป็น UTF-8
  const lines = [headers, ...rows].map((r) => r.map(esc).join(","));
  return BOM + lines.join("\r\n");
}
