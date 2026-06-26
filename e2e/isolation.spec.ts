import { test, expect, type Page } from "@playwright/test";
import {
  STORE_A,
  STORE_B,
  PASSWORD,
  A_ORDER_NO,
  B_ORDER_NO,
  A_TOKEN,
  B_TOKEN,
} from "./fixtures/constants";
import { getOrderIdByToken } from "./fixtures/db";

/* Phase 5 — เคสความปลอดภัยที่สำคัญที่สุด:
   ร้านหนึ่ง login แล้วต้องเข้าถึง order ของอีกร้านไม่ได้ (ทั้งหน้า /admin และ deep link) */

async function login(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL("**/admin");
}

test.describe("per-store isolation", () => {
  test("ร้าน A เปิด order ของร้าน B ตรง ๆ ไม่ได้ (404)", async ({ page }) => {
    await login(page, STORE_A.email);

    const bOrderId = getOrderIdByToken(B_TOKEN);
    expect(bOrderId).toBeTruthy();

    const resp = await page.goto(`/admin/orders/${bOrderId}`);
    expect(resp?.status()).toBe(404);
  });

  test("ร้าน B เปิด order ของร้าน A ตรง ๆ ไม่ได้ (404)", async ({ page }) => {
    await login(page, STORE_B.email);

    const aOrderId = getOrderIdByToken(A_TOKEN);
    expect(aOrderId).toBeTruthy();

    const resp = await page.goto(`/admin/orders/${aOrderId}`);
    expect(resp?.status()).toBe(404);
  });

  test("dashboard ของร้าน A เห็นเฉพาะ order ของตัวเอง", async ({ page }) => {
    await login(page, STORE_A.email);

    await expect(page.getByText(A_ORDER_NO)).toBeVisible();
    await expect(page.getByText(B_ORDER_NO)).toHaveCount(0);
  });

  test("ต้อง login ก่อนถึงเข้า /admin ได้ (ไม่มี session → เด้ง login)", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL("**/admin/login");
    await expect(page.locator("#email")).toBeVisible();
  });
});
