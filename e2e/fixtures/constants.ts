/** ค่าคงที่ของข้อมูลทดสอบ e2e — ใช้ร่วมกันทั้งฝั่ง CLI (tsx) และ spec (playwright) */

export const PASSWORD = "E2e-pass-word-1";

export const STORE_A = {
  slug: "e2e-store-a",
  name: "E2E Store A",
  email: "owner-a@e2e.test",
} as const;

export const STORE_B = {
  slug: "e2e-store-b",
  name: "E2E Store B",
  email: "owner-b@e2e.test",
} as const;

// orderNo / token ที่ seed ไว้ล่วงหน้า (ใช้ assert การแยกข้อมูลระหว่างร้าน)
export const A_ORDER_NO = "E2EAAA1";
export const B_ORDER_NO = "E2EBBB1";
export const A_TOKEN = "e2e_token_a1";
export const B_TOKEN = "e2e_token_b1";
