import "server-only";
import type { SlipParseResult, SlipVerifier } from "./types";

/* Adapter สำหรับ EasySlip (https://document.easyslip.com)
   ส่งรูปสลิปแบบ multipart → API อ่าน QR ในสลิป → คืนยอด/บัญชีผู้รับ/เลขอ้างอิง
   Auth: Bearer <EASYSLIP_API_KEY> */

const ENDPOINT = "https://developer.easyslip.com/api/v1/verify";

/** โครงสร้าง response ของ EasySlip เท่าที่เราใช้ (ฟิลด์อื่นมีอีกแต่ไม่ใช้) */
type EasySlipResponse = {
  status?: number;
  message?: string;
  data?: {
    transRef?: string;
    date?: string;
    amount?: { amount?: number | string };
    receiver?: {
      account?: {
        name?: { th?: string; en?: string };
        bank?: { account?: string };
        proxy?: { account?: string };
      };
    };
  };
};

/** แปลง error code ของ EasySlip → ข้อความภาษาคนให้ร้าน/ลูกค้าเข้าใจ */
function mapError(code: string): string {
  switch (code) {
    case "invalid_payload":
    case "image_invalid":
    case "slip_not_found":
      return "อ่านสลิปไม่ออก (อาจไม่ใช่สลิปโอนเงิน หรือรูปไม่ชัด)";
    case "duplicate_slip":
      return "สลิปนี้ถูกใช้ไปแล้ว";
    case "account_not_found":
      return "ไม่พบข้อมูลบัญชีในสลิป";
    case "quota_exceeded":
    case "application_expired":
      return "โควต้าตรวจสลิปหมด/บัญชีหมดอายุ (ตรวจสอบ EasySlip)";
    case "access_denied":
    case "unauthorized":
      return "คีย์ตรวจสลิปไม่ถูกต้อง (ตรวจสอบ EASYSLIP_API_KEY)";
    default:
      return "ตรวจสลิปไม่สำเร็จ";
  }
}

export function easySlipVerifier(apiKey: string): SlipVerifier {
  return {
    async verify(file: File): Promise<SlipParseResult> {
      const form = new FormData();
      form.append("file", file, file.name || "slip.jpg");

      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
      } catch {
        return { genuine: false, error: "เชื่อมต่อบริการตรวจสลิปไม่ได้" };
      }

      let json: EasySlipResponse | null = null;
      try {
        json = (await res.json()) as EasySlipResponse;
      } catch {
        /* ตอบกลับไม่ใช่ JSON */
      }

      const data = json?.data;
      if (!res.ok || !data) {
        return { genuine: false, error: mapError(json?.message ?? `http_${res.status}`) };
      }

      const rawAmount = data.amount?.amount;
      const amount =
        typeof rawAmount === "number"
          ? rawAmount
          : rawAmount != null && rawAmount !== ""
            ? Number(rawAmount)
            : undefined;

      const acc = data.receiver?.account;
      return {
        genuine: true,
        transRef: data.transRef || undefined,
        amount: Number.isFinite(amount) ? amount : undefined,
        paidAt: data.date ? new Date(data.date) : undefined,
        receiverName: acc?.name?.th || acc?.name?.en || undefined,
        receiverAccount: acc?.proxy?.account || acc?.bank?.account || undefined,
      };
    },
  };
}
