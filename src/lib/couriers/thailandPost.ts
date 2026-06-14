import "server-only";
import type { CourierAdapter, TrackResult } from "./types";
import { descriptionMeansDelivered } from "./types";

/* ===========================================================================
 *  Thailand Post — Track & Trace API (ทางการ)
 *  สมัครคีย์: https://track.thailandpost.co.th  →  เมนู API / Developer
 *  .env →  THAILANDPOST_API_KEY="..."
 *  ขั้นตอน: (1) เอา API key แลก JWT  (2) ใช้ JWT ยิง /track ตามบาร์โค้ด
 *  status code 501/511 = นำจ่ายสำเร็จ
 * =========================================================================== */

const API_BASE = "https://trackapi.thailandpost.co.th/post/api/v1";

function apiKey(): string {
  return process.env.THAILANDPOST_API_KEY?.trim() ?? "";
}

let cachedToken: { token: string; expireMs: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expireMs > now + 60_000) return cachedToken.token;

  const res = await fetch(`${API_BASE}/authenticate/token`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey()}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`auth ล้มเหลว (HTTP ${res.status})`);
  const data = (await res.json()) as { token?: string; expire?: string };
  if (!data.token) throw new Error("auth ไม่คืน token");
  cachedToken = {
    token: data.token,
    expireMs: data.expire ? new Date(data.expire).getTime() : now + 23 * 3600_000,
  };
  return data.token;
}

const DELIVERED_CODES = new Set(["501", "511"]);

export const thailandPost: CourierAdapter = {
  isConfigured: () => apiKey().length > 0,

  async getStatus(barcode: string): Promise<TrackResult> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        found: false,
        delivered: false,
        error: "ยังไม่ได้ตั้งค่า THAILANDPOST_API_KEY ใน .env",
      };
    }
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/track`, {
        method: "POST",
        headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "all", language: "TH", barcode: [barcode] }),
        cache: "no-store",
      });
      if (!res.ok) {
        return { configured: true, found: false, delivered: false, error: `เช็คสถานะล้มเหลว (HTTP ${res.status})` };
      }
      const data = (await res.json()) as {
        response?: {
          items?: Record<string, { status?: string; status_description?: string; status_date?: string; location?: string }[]>;
        };
      };
      const items = data?.response?.items?.[barcode];
      if (!items || items.length === 0) {
        return { configured: true, found: false, delivered: false };
      }
      const last = items[items.length - 1];
      const delivered = items.some(
        (e) => DELIVERED_CODES.has(String(e.status ?? "")) || descriptionMeansDelivered(String(e.status_description ?? ""))
      );
      return {
        configured: true,
        found: true,
        delivered,
        statusDescription: last?.status_description,
        statusDate: last?.status_date,
        history: items.map((e) => ({
          description: e.status_description ?? "",
          date: e.status_date ?? "",
          location: e.location,
        })),
      };
    } catch (e) {
      return {
        configured: true,
        found: false,
        delivered: false,
        error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      };
    }
  },
};
