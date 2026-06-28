import "server-only";
import { headers } from "next/headers";

/**
 * origin ของแอป (เช่น https://shop.vercel.app) สำหรับฝังลิงก์ในข้อความแจ้งเตือน
 * อ่านจาก header ของ request ก่อน (รองรับ custom domain) → fallback ที่ env APP_URL
 */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return (process.env.APP_URL ?? "").replace(/\/$/, "");
}
