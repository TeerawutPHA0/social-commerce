import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { lineReply } from "@/lib/notify/line";

/* Webhook ของ LINE OA — จับ userId ของร้าน (ปลายทางรับ push)
   ร้านทักแชต/แอด OA → LINE ยิง event มาที่นี่ → บันทึก source.userId ลง Store
   ยืนยันตัวตนด้วยลายเซ็น x-line-signature = base64(HMAC-SHA256(channelSecret, rawBody))
   โมเดล 1 deploy = 1 ร้าน → หา store ที่ตั้ง secret ไว้แล้ว match ลายเซ็นทีละร้าน */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
};

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function safeDecrypt(enc: string): string | null {
  try {
    return decrypt(enc);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const stores = await prisma.store.findMany({
    where: { lineChannelSecret: { not: null } },
    select: { id: true, name: true, lineChannelSecret: true, lineChannelToken: true },
  });

  // หา store ที่ channel secret ตรงกับลายเซ็นของ request นี้
  let matched: (typeof stores)[number] | null = null;
  for (const s of stores) {
    const secret = safeDecrypt(s.lineChannelSecret!);
    if (!secret) continue;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
    if (signature && timingSafeEqualStr(signature, expected)) {
      matched = s;
      break;
    }
  }
  if (!matched) return new Response("invalid signature", { status: 401 });

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const token = matched.lineChannelToken ? safeDecrypt(matched.lineChannelToken) : null;

  for (const ev of payload.events ?? []) {
    const userId = ev.source?.userId;
    if (!userId) continue;
    // follow (แอดเพื่อน) หรือ message (ทักแชต) → ถือว่านี่คือร้าน เก็บ userId ไว้ push ภายหลัง
    if (ev.type === "follow" || ev.type === "message") {
      await prisma.store.update({ where: { id: matched.id }, data: { lineUserId: userId } });
      if (token && ev.replyToken) {
        await lineReply(
          token,
          ev.replyToken,
          `✅ เชื่อมต่อ LINE สำเร็จ!\nร้าน "${matched.name}" จะได้รับแจ้งเตือนที่นี่เมื่อมีสลิปใหม่รอตรวจสอบ`
        ).catch(() => {});
      }
    }
  }

  return new Response("ok");
}
