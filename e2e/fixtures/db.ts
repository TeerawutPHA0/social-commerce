import { execSync } from "node:child_process";
import path from "node:path";

/* Wrapper บางๆ ที่ Playwright เรียกใช้ — shell ออกไปรัน db-cli.ts ด้วย tsx
   (เลี่ยงให้ Playwright transpile generated prisma client เอง) แล้ว parse JSON กลับมา
   ใช้ execSync ผ่าน shell เพื่อให้ resolve npx (.cmd บน Windows) + quote path ที่มี space */

const CLI = path.join(process.cwd(), "e2e", "fixtures", "db-cli.ts");

function run<T = unknown>(...args: string[]): T {
  const quoted = [CLI, ...args].map((a) => `"${a}"`).join(" ");
  const out = execSync(`npx tsx ${quoted}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"], // stderr ผ่านขึ้นจอ เพื่อ debug ง่าย
  });
  // เอาบรรทัด JSON สุดท้าย (เผื่อ dotenv/tooling พิมพ์ tip ขึ้นก่อน)
  const lines = out.trim().split(/\r?\n/).filter(Boolean);
  const last = lines.pop();
  return (last ? JSON.parse(last) : null) as T;
}

export type SeedResult = {
  a: { storeId: string; orderId: string };
  b: { storeId: string; orderId: string };
};

export function seedTestData(): SeedResult {
  return run<SeedResult>("seed");
}

export function cleanupTestData(): void {
  run("cleanup");
}

export function getOrderIdByToken(token: string): string | null {
  return run<string | null>("id-by-token", token);
}

export function getOrderByToken(token: string): { id: string; paymentStatus: string; paymentSlipUrl: string | null } | null {
  return run("order-by-token", token);
}
