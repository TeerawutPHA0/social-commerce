/* ข้อมูลการชำระเงินของร้าน (แก้ได้ที่นี่ที่เดียว) */

export type PaymentMethod = { label: string; value: string; note?: string };

export const PAYMENT_INFO = {
  /** รูป QR (อยู่ใน /public) */
  qrImage: "/qrcode.jpg",
  accountName: "ณัฐวิภา ชะลาลัย",
  methods: [
    { label: "kbank (กสิกร)", value: "069-2-94362-7" },
    { label: "true wallet", value: "095-886-5714", note: "ไม่มีพร้อมเพย์นะคะ" },
  ] as PaymentMethod[],
  warning: "รบกวนเช็คเลขก่อนโอนนะคะ",
};
