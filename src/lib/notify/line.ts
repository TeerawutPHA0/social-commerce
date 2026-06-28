import "server-only";

/* ตัวเชื่อม LINE Messaging API (push/reply ข้อความ text)
   - ทุกฟังก์ชันคืน {ok} / {error} ไม่ throw — ผู้เรียกตัดสินใจเองว่าจะ log/แสดง
   - มี timeout กันค้าง (serverless มี budget เวลาจำกัด) */

const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

export type LineResult = { ok?: boolean; error?: string };

async function post(url: string, token: string, body: unknown): Promise<LineResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { error: `LINE API ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") return { error: "LINE API หมดเวลา" };
    return { error: e instanceof Error ? e.message : "ส่ง LINE ไม่สำเร็จ" };
  }
}

/** push ข้อความ text หา userId ปลายทาง */
export function linePush(token: string, to: string, text: string): Promise<LineResult> {
  return post(PUSH_URL, token, { to, messages: [{ type: "text", text }] });
}

/** ตอบกลับ event ด้วย replyToken (ใช้ใน webhook ตอนเชื่อมต่อสำเร็จ) */
export function lineReply(token: string, replyToken: string, text: string): Promise<LineResult> {
  return post(REPLY_URL, token, { replyToken, messages: [{ type: "text", text }] });
}
