import { test, expect, type Locator } from "@playwright/test";
import path from "node:path";
import { STORE_A, PASSWORD } from "./fixtures/constants";
import { getOrderByToken } from "./fixtures/db";

/* Phase 5 — e2e flow หลักครบ loop:
   ร้านสร้างบิล → ลูกค้ากรอกที่อยู่ → ลูกค้าอัพสลิป → ร้านยืนยันการชำระเงิน */

const SLIP = path.join(process.cwd(), "e2e", "fixtures", "slip.png");

/** fill ช่อง controlled input ให้ค่าติดแน่ (retry กัน hydration race ของ React) */
async function fillStable(locator: Locator, value: string) {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 15_000 });
}

test("full loop: สร้างบิล → ที่อยู่ → สลิป → approve", async ({ page }) => {
  // 1) ร้าน A login
  await page.goto("/admin/login");
  await page.fill("#email", STORE_A.email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL("**/admin");

  // 2) สร้างออเดอร์ใหม่ (เว้นที่อยู่ว่าง → ลูกค้าจะกรอกเอง)
  await page.goto("/admin/orders/new");
  await fillStable(page.getByRole("combobox", { name: "ชื่อสินค้า" }), "เสื้อยืดทดสอบ");
  await fillStable(page.getByPlaceholder("ราคา").first(), "250");
  await page.getByRole("button", { name: "สร้างออเดอร์" }).click();

  // redirect → /admin?created=<token>&no=<orderNo>
  await page.waitForURL(/created=/);
  const token = new URL(page.url()).searchParams.get("created");
  expect(token).toBeTruthy();

  // 3) ลูกค้า (ไม่ต้อง login) เปิดลิงก์บิล → กรอกที่อยู่
  await page.goto(`/track/${token}`);
  await fillStable(page.getByLabel("ชื่อผู้รับ"), "คุณลูกค้า ทดสอบ");
  await fillStable(
    page.getByLabel("ที่อยู่ผู้รับ"),
    "99/9 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ"
  );
  await fillStable(page.getByLabel("รหัสไปรษณีย์"), "10110");
  await fillStable(page.getByLabel("เบอร์โทรศัพท์"), "0812345678");
  // PDPA: ต้องยอมรับนโยบายก่อนบันทึกที่อยู่
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "บันทึกที่อยู่" }).click();

  // ที่อยู่ครบ → ส่วนชำระเงินโผล่
  await expect(page.getByRole("button", { name: "ส่งสลิป" })).toBeVisible();

  // 4) ลูกค้าอัพสลิป → สถานะ = รอตรวจสอบ
  await page.setInputFiles('input[type="file"]', SLIP);
  await page.getByRole("button", { name: "ส่งสลิป" }).click();
  await expect(page.getByText("กำลังตรวจสอบการชำระเงิน")).toBeVisible();

  // DB: paymentStatus = pending + มี slipUrl
  await expect.poll(() => getOrderByToken(token!)?.paymentStatus).toBe("pending");
  expect(getOrderByToken(token!)?.paymentSlipUrl).toBeTruthy();

  // 5) ร้านเข้าหน้าแก้ไขออเดอร์ → ยืนยันการชำระเงิน
  const order = getOrderByToken(token!);
  await page.goto(`/admin/orders/${order!.id}`);
  await page.getByRole("button", { name: "ยืนยันชำระเงิน" }).click();

  // 6) สถานะกลายเป็น paid
  await expect.poll(() => getOrderByToken(token!)?.paymentStatus).toBe("paid");
});
