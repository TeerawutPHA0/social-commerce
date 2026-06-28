import { test, expect, type Page } from "@playwright/test";
import { STORE_A, PASSWORD } from "./fixtures/constants";

/* Phase 9 — จัดการบัญชี/พนักงาน + สิทธิ์ owner vs staff
   ครอบ: owner เพิ่ม/ลบ staff, staff login ได้, staff ถูกกันออกจากหน้า/ลิงก์ตั้งค่า (requireOwner) */

const STAFF_EMAIL = "staff_phase9@e2e.test";
const STAFF_PW = "Staff-pass-1";

async function login(page: Page, email: string, pw: string) {
  await page.goto("/admin/login");
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL("**/admin");
}

test("owner เพิ่ม/ลบ staff ได้ + staff ถูกจำกัดสิทธิ์", async ({ page }) => {
  // owner เห็นลิงก์ "ตั้งค่า" + จัดการพนักงานได้
  await login(page, STORE_A.email, PASSWORD);
  await expect(page.getByRole("link", { name: "ตั้งค่า" })).toBeVisible();

  await page.goto("/admin/account");
  await page.fill('input[placeholder="อีเมลพนักงาน"]', STAFF_EMAIL);
  await page.fill('input[placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"]', STAFF_PW);
  await page.getByRole("button", { name: "เพิ่มพนักงาน" }).click();
  await expect(page.getByText(STAFF_EMAIL)).toBeVisible();

  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await page.waitForURL("**/admin/login");

  // staff login ได้ (รหัสที่ owner ตั้งให้ใช้งานจริง)
  await login(page, STAFF_EMAIL, STAFF_PW);

  // staff: ไม่มีลิงก์ "ตั้งค่า" + เข้าหน้า settings ตรง ๆ ถูกเด้งกลับ /admin
  await expect(page.getByRole("link", { name: "ตั้งค่า" })).toHaveCount(0);
  await page.goto("/admin/settings");
  await page.waitForURL("**/admin");
  expect(page.url()).not.toContain("/settings");

  // staff: หน้าบัญชีไม่มีส่วนจัดการพนักงาน
  await page.goto("/admin/account");
  await expect(page.getByText("เพิ่มพนักงานใหม่")).toHaveCount(0);

  // กลับมา owner ลบ staff
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await page.waitForURL("**/admin/login");
  await login(page, STORE_A.email, PASSWORD);
  await page.goto("/admin/account");
  page.on("dialog", (d) => d.accept()); // ยืนยัน window.confirm
  await page
    .getByText(STAFF_EMAIL)
    .locator("xpath=ancestor::li")
    .getByRole("button", { name: "ลบ" })
    .click();
  await expect(page.getByText(STAFF_EMAIL)).toHaveCount(0);
});
