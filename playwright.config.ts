import { defineConfig, devices } from "@playwright/test";

/* e2e (Phase 5) — รันกับ DB dev ปัจจุบัน, dev server ของ Next
   ข้อมูลทดสอบใช้ร้าน e2e-store-a / e2e-store-b เท่านั้น (seed/teardown ลบเฉพาะของตัวเอง) */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // แชร์ DB เดียวกัน — รันเรียงเพื่อกัน state ชนกัน
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    // ใช้ localhost (ไม่ใช่ 127.0.0.1) ให้ origin ตรงกับ default host ของ Next dev
    // ไม่งั้น Next 16 มอง request เป็น cross-origin แล้วตัด redirect ของ server action ทิ้ง
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
