import { seedTestData } from "./fixtures/db";

/** seed ร้านทดสอบ A + B ก่อนรันชุดเทสต์ */
export default function globalSetup() {
  seedTestData();
}
