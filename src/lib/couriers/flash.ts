import "server-only";
import crypto from "node:crypto";
import type { CourierAdapter, TrackResult } from "./types";
import { descriptionMeansDelivered } from "./types";

/* ===========================================================================
 *  Flash Express — Open API (ต้องเป็น merchant + มี credentials)
 *  สมัคร/ขอ key: https://open.flashexpress.com (merchant open platform)
 *  .env →  FLASH_MCH_ID="...",  FLASH_SECRET_KEY="..."   (ออปชัน FLASH_API_BASE)
 *
 *  การเซ็น (ตามเอกสาร Flash): เรียง params ตาม ASCII → "k=v&..." + "&key=SECRET"
 *  → SHA256 → ตัวพิมพ์ใหญ่ ใส่เป็นฟิลด์ sign. ส่งแบบ x-www-form-urlencoded.
 *  หมายเหตุ: endpoint/รูปแบบ response ควรตรวจกับบัญชีจริงอีกครั้ง (state 4 = นำจ่ายสำเร็จ)
 * =========================================================================== */

const BASE = process.env.FLASH_API_BASE?.trim() || "https://open-api.flashexpress.com";
const mchId = () => process.env.FLASH_MCH_ID?.trim() ?? "";
const secret = () => process.env.FLASH_SECRET_KEY?.trim() ?? "";

function sign(params: Record<string, string>): string {
  const stringA = Object.keys(params)
    .filter((k) => params[k] !== "" && k !== "sign")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha256").update(`${stringA}&key=${secret()}`, "utf8").digest("hex").toUpperCase();
}

export const flash: CourierAdapter = {
  isConfigured: () => mchId().length > 0 && secret().length > 0,

  async getStatus(barcode: string): Promise<TrackResult> {
    if (!this.isConfigured()) {
      return { configured: false, found: false, delivered: false, error: "ยังไม่ได้ตั้งค่า FLASH_MCH_ID / FLASH_SECRET_KEY" };
    }
    try {
      const params: Record<string, string> = {
        mchId: mchId(),
        nonceStr: crypto.randomBytes(8).toString("hex"),
        pno: barcode,
      };
      params.sign = sign(params);

      const res = await fetch(`${BASE}/open/v1/orders/${encodeURIComponent(barcode)}/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
        cache: "no-store",
      });
      if (!res.ok) return { configured: true, found: false, delivered: false, error: `เช็คสถานะล้มเหลว (HTTP ${res.status})` };

      const data = (await res.json()) as { data?: { routes?: { message?: string; routedAt?: string; state?: number }[] } };
      const routes = data?.data?.routes ?? [];
      if (routes.length === 0) return { configured: true, found: false, delivered: false };

      const last = routes[routes.length - 1];
      const delivered = routes.some((r) => r.state === 4 || descriptionMeansDelivered(String(r.message ?? "")));
      return {
        configured: true,
        found: true,
        delivered,
        statusDescription: last?.message,
        statusDate: last?.routedAt,
        history: routes.map((r) => ({ description: r.message ?? "", date: r.routedAt ?? "" })),
      };
    } catch (e) {
      return { configured: true, found: false, delivered: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" };
    }
  },
};
