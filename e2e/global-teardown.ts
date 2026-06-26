import { cleanupTestData } from "./fixtures/db";

/** ลบร้านทดสอบทั้งหมดหลังจบชุดเทสต์ (ไม่ทิ้งขยะใน DB dev) */
export default function globalTeardown() {
  cleanupTestData();
}
