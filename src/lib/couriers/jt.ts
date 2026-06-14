import "server-only";
import crypto from "node:crypto";
import type { CourierAdapter, TrackResult } from "./types";
import { descriptionMeansDelivered } from "./types";

/* ===========================================================================
 *  J&T Express (Thailand) — Track API (ต้องเป็นลูกค้า + มี credentials)
 *  ขอ key กับฝ่ายธุรกิจ J&T: apiAccount + privateKey + customerCode
 *  .env →  JT_API_ACCOUNT="...", JT_PRIVATE_KEY="...", JT_CUSTOMER_CODE="..."
 *          (ออปชัน JT_API_BASE)
 *
 *  การเซ็น (ตามเอกสาร J&T): digest = Base64( MD5( bizContent + privateKey ) )
 *  ส่งแบบ form: { bizContent, digest, apiAccount, timestamp }
 *  หมายเหตุ: endpoint/รูปแบบ response ต่างตามสัญญา — ตรวจกับเอกสารบัญชีจริงอีกครั้ง
 * =========================================================================== */

const BASE = process.env.JT_API_BASE?.trim() || "https://jtexpress-th.jtjms-th.com/jts-operation-base-inter/api";
const account = () => process.env.JT_API_ACCOUNT?.trim() ?? "";
const privateKey = () => process.env.JT_PRIVATE_KEY?.trim() ?? "";
const customerCode = () => process.env.JT_CUSTOMER_CODE?.trim() ?? "";

function digest(bizContent: string): string {
  return crypto.createHash("md5").update(bizContent + privateKey(), "utf8").digest("base64");
}

export const jt: CourierAdapter = {
  isConfigured: () => account().length > 0 && privateKey().length > 0,

  async getStatus(barcode: string): Promise<TrackResult> {
    if (!this.isConfigured()) {
      return { configured: false, found: false, delivered: false, error: "ยังไม่ได้ตั้งค่า JT_API_ACCOUNT / JT_PRIVATE_KEY" };
    }
    try {
      const bizContent = JSON.stringify({ billCodes: [barcode], customerCode: customerCode() });
      const body = new URLSearchParams({
        bizContent,
        digest: digest(bizContent),
        apiAccount: account(),
        timestamp: String(Date.now()),
      }).toString();

      const res = await fetch(`${BASE}/logistics/trace`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      });
      if (!res.ok) return { configured: true, found: false, delivered: false, error: `เช็คสถานะล้มเหลว (HTTP ${res.status})` };

      const data = (await res.json()) as {
        data?: { details?: { scanType?: string; desc?: string; scanTime?: string; scanNetworkProvince?: string }[] }[];
      };
      const details = data?.data?.[0]?.details ?? [];
      if (details.length === 0) return { configured: true, found: false, delivered: false };

      const last = details[details.length - 1];
      const delivered = details.some(
        (d) => /POD|delivered|signed/i.test(String(d.scanType ?? "")) || descriptionMeansDelivered(String(d.desc ?? ""))
      );
      return {
        configured: true,
        found: true,
        delivered,
        statusDescription: last?.desc,
        statusDate: last?.scanTime,
        history: details.map((d) => ({ description: d.desc ?? "", date: d.scanTime ?? "", location: d.scanNetworkProvince })),
      };
    } catch (e) {
      return { configured: true, found: false, delivered: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" };
    }
  },
};
