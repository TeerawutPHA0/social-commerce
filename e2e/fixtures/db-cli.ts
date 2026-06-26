import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../../src/lib/password";
import {
  STORE_A,
  STORE_B,
  PASSWORD,
  A_ORDER_NO,
  B_ORDER_NO,
  A_TOKEN,
  B_TOKEN,
} from "./constants";

/* CLI ช่วยจัดการข้อมูลทดสอบ e2e — รันด้วย tsx (toolchain เดียวกับ prisma/seed.ts)
   เพื่อให้ Playwright ไม่ต้อง transpile generated prisma client เอง
   ใช้: tsx db-cli.ts <seed|cleanup|id-by-token <token>|order-by-token <token>>
   ผลลัพธ์เป็น JSON บรรทัดสุดท้ายของ stdout */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** ลบร้านทดสอบทั้งสอง (cascade → users/orders/products หายตาม) — ไม่แตะ data dev อื่น */
async function cleanup() {
  await prisma.store.deleteMany({
    where: { slug: { in: [STORE_A.slug, STORE_B.slug] } },
  });
}

async function makeStore(
  s: { slug: string; name: string; email: string },
  orderNo: string,
  token: string
) {
  const passwordHash = await hashPassword(PASSWORD);
  return prisma.store.create({
    data: {
      slug: s.slug,
      name: s.name,
      users: { create: { email: s.email, passwordHash, role: "owner" } },
      orders: {
        create: {
          token,
          orderNo,
          storeName: s.name,
          status: "received",
          shippingFee: 0,
          shippingName: `ลูกค้า ${s.name}`,
          shippingPhone: "0800000000",
          shippingAddress: "123 ถนนทดสอบ แขวงทดสอบ เขตทดสอบ กรุงเทพฯ",
          shippingPostcode: "10000",
          paymentStatus: "unpaid",
          items: { create: [{ name: "สินค้าทดสอบ", qty: 1, price: 100 }] },
        },
      },
    },
    include: { orders: true },
  });
}

/** สร้างร้าน A + B พร้อม owner และ order ร้านละ 1 ใบ (idempotent — cleanup ก่อนเสมอ) */
async function seed() {
  await cleanup();
  const a = await makeStore(STORE_A, A_ORDER_NO, A_TOKEN);
  const b = await makeStore(STORE_B, B_ORDER_NO, B_TOKEN);
  return {
    a: { storeId: a.id, orderId: a.orders[0].id },
    b: { storeId: b.id, orderId: b.orders[0].id },
  };
}

const [cmd, arg] = process.argv.slice(2);

(async () => {
  let result: unknown = null;
  switch (cmd) {
    case "seed":
      result = await seed();
      break;
    case "cleanup":
      await cleanup();
      result = { ok: true };
      break;
    case "id-by-token": {
      const o = await prisma.order.findUnique({ where: { token: arg } });
      result = o?.id ?? null;
      break;
    }
    case "order-by-token":
      result = await prisma.order.findUnique({ where: { token: arg } });
      break;
    default:
      throw new Error(`unknown command: ${cmd}`);
  }
  process.stdout.write(JSON.stringify(result) + "\n");
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
