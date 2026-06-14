/**
 * คัดลอกข้อความลง clipboard — เรียกจากฝั่ง client เท่านั้น
 * รองรับทั้ง https/localhost (Clipboard API) และ http เปิดผ่าน IP วง LAN (execCommand fallback)
 * คืน true ถ้าสำเร็จ
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // secure context (https หรือ localhost) → ใช้ Clipboard API ปกติ
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* ตกไป fallback ข้างล่าง */
    }
  }
  // fallback สำหรับ http:// — สร้าง textarea ชั่วคราวแล้ว execCommand("copy")
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
