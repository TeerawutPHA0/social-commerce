import "server-only";
import type { CourierAdapter, TrackResult } from "./types";
import { descriptionMeansDelivered } from "./types";

/* ===========================================================================
 *  Kerry Express (KEX) — Tracking API (ต้องทำสัญญา B2B + ได้ token/endpoint)
 *  Kerry ไม่มี public API ฟรีสำหรับร้านเล็ก — ต้องติดต่อฝ่ายธุรกิจเพื่อขอ
 *  API token + endpoint เฉพาะของบัญชี
 *  .env →  KERRY_API_TOKEN="...",  KERRY_API_BASE="https://..."
 *
 *  หมายเหตุ: path/header/รูปแบบ response แตกต่างตามสัญญา — ปรับตามเอกสารที่ Kerry ให้
 * =========================================================================== */

const BASE = process.env.KERRY_API_BASE?.trim() ?? "";
const token = () => process.env.KERRY_API_TOKEN?.trim() ?? "";

export const kerry: CourierAdapter = {
  isConfigured: () => token().length > 0 && BASE.length > 0,

  async getStatus(barcode: string): Promise<TrackResult> {
    if (!this.isConfigured()) {
      return { configured: false, found: false, delivered: false, error: "ยังไม่ได้ตั้งค่า KERRY_API_TOKEN / KERRY_API_BASE" };
    }
    try {
      const res = await fetch(`${BASE.replace(/\/$/, "")}/track?consignment=${encodeURIComponent(barcode)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return { configured: true, found: false, delivered: false, error: `เช็คสถานะล้มเหลว (HTTP ${res.status})` };

      const data = (await res.json()) as {
        events?: { status?: string; description?: string; datetime?: string; location?: string }[];
      };
      const events = data?.events ?? [];
      if (events.length === 0) return { configured: true, found: false, delivered: false };

      const last = events[events.length - 1];
      const delivered = events.some(
        (ev) => /delivered|pod|signed/i.test(String(ev.status ?? "")) || descriptionMeansDelivered(String(ev.description ?? ""))
      );
      return {
        configured: true,
        found: true,
        delivered,
        statusDescription: last?.description,
        statusDate: last?.datetime,
        history: events.map((ev) => ({ description: ev.description ?? "", date: ev.datetime ?? "", location: ev.location })),
      };
    } catch (e) {
      return { configured: true, found: false, delivered: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" };
    }
  },
};
