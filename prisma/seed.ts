import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** ข้อมูลตัวอย่าง (ย้ายมาจาก mock เดิม) — ร้าน puffiepiece */
async function main() {
  // ร้านเริ่มต้น (idempotent ด้วย upsert ตาม slug) — ข้อมูลรับเงินแก้ได้ที่ /admin/settings
  const store = await prisma.store.upsert({
    where: { slug: "puffiepiece" },
    update: {},
    create: {
      slug: "puffiepiece",
      name: "puffiepiece",
      logo: "/logo.jpg",
      payAccountName: "ณัฐวิภา ชะลาลัย",
      payMethods: [
        { label: "kbank (กสิกร)", value: "069-2-94362-7" },
        { label: "true wallet", value: "095-886-5714", note: "ไม่มีพร้อมเพย์นะคะ" },
      ],
      payQrImage: "/qrcode.jpg",
      payWarning: "รบกวนเช็คเลขก่อนโอนนะคะ",
      defaultShippingFee: 0,
    },
  });

  // owner user (ถ้าตั้ง ADMIN_EMAIL + ADMIN_PASSWORD ใน env) — ใช้ login ฝั่ง admin
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, storeId: store.id, role: "owner" },
      create: { email: adminEmail, passwordHash, storeId: store.id, role: "owner" },
    });
    console.log(`  ✓ owner user "${adminEmail}"`);
  } else {
    console.log("  ⚠️  ข้าม owner user (ตั้ง ADMIN_EMAIL + ADMIN_PASSWORD แล้วรัน prisma/create-owner.ts)");
  }

  // ล้างออเดอร์ของร้านนี้ก่อน เพื่อให้ seed ซ้ำได้ (idempotent)
  await prisma.order.deleteMany({ where: { storeId: store.id } });

  const base = { storeId: store.id, storeName: store.name, storeLogo: store.logo };

  await prisma.order.create({
    data: {
      ...base,
      token: "order_9b1a2c3f",
      orderNo: "PF2901",
      createdAt: new Date("2026-05-29T14:35:00+07:00"),
      status: "preparing",
      shippingFee: 0,
      shippingName: "prim piece",
      shippingPhone: "0958865714",
      shippingAddress:
        "The Light A condominium, เลขที่ 41/94, ตำบลแสนสุข อำเภอเมืองชลบุรี จังหวัดชลบุรี 20130",
      paymentStatus: "paid",
      paymentTransferredAmount: 1290,
      paymentTransferredAt: new Date("2026-05-29T14:35:00+07:00"),
      note: "🛍️ ช้อปปิ้งของในรอบบินครบ 1000฿ ส่งฟรี ✈️ รอบบิน 28 พ.ค.–11 มิ.ย. (จัดส่ง 13–17 มิ.ย.) แอดมินจะส่งรูปรายการสินค้าให้ยืนยันก่อนส่งนะคะ 💗 ขอบคุณมากค่ะ",
      items: {
        create: [
          { name: "เสื้อครอปแขนยาว สีครีม (Size M)", qty: 1, price: 390 },
          { name: "กระโปรงลายจุด สีขาว (Size S)", qty: 2, price: 450 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      ...base,
      token: "order_7d4e5f6a",
      orderNo: "PF1508",
      createdAt: new Date("2026-05-08T21:31:00+07:00"),
      status: "shipped",
      shippingFee: 0,
      shippingName: "ฟ้าใส รักช้อป",
      shippingPhone: "0812345678",
      shippingAddress:
        "99/123 หมู่บ้านสุขใจ ซอย 5 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร 10900",
      paymentStatus: "paid",
      paymentTransferredAmount: 950,
      paymentTransferredAt: new Date("2026-05-08T20:10:00+07:00"),
      trackingCourier: "thailand-post",
      trackingNo: "EQ158234419TH",
      note: "📦 เลขพัสดุขึ้นอัพเดทในลิงก์บิลนี้แล้วค่ะ จัดส่งด่วนโดยไปรษณีย์ไทย EMS ✨ ขอบคุณมากค่ะ 💗",
      items: {
        create: [
          { name: "เดรสสายเดี่ยว สีฟ้าพาสเทล (Size M)", qty: 1, price: 590 },
          { name: "ที่คาดผมโบว์ สีชมพู", qty: 3, price: 120 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      ...base,
      token: "order_delivered_demo",
      orderNo: "PF0420",
      createdAt: new Date("2026-04-20T10:05:00+07:00"),
      status: "delivered",
      shippingFee: 50,
      shippingName: "มะลิ ใจดี",
      shippingPhone: "0899998888",
      shippingAddress:
        "12 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200",
      paymentStatus: "paid",
      paymentTransferredAmount: 840,
      paymentTransferredAt: new Date("2026-04-20T09:50:00+07:00"),
      trackingCourier: "flash",
      trackingNo: "TH01234567890",
      items: {
        create: [{ name: "เซ็ตเสื้อ + กางเกง สีน้ำตาล (Size L)", qty: 1, price: 790 }],
      },
    },
  });

  // ออเดอร์ใหม่ล่าสุด: ที่อยู่ว่าง + ยังไม่จ่าย → โชว์ flow เต็ม (กรอกที่อยู่ → ชำระเงิน)
  await prisma.order.create({
    data: {
      ...base,
      token: "order_new_demo",
      orderNo: "PF6014",
      createdAt: new Date(),
      status: "received",
      shippingFee: 0,
      shippingName: "",
      shippingPhone: "",
      shippingAddress: "",
      paymentStatus: "unpaid",
      paymentTransferredAmount: 0,
      note: "🛍️ รบกวนลูกค้ากรอกที่อยู่ + ชำระเงินผ่านลิงก์นี้นะคะ จัดส่งโดยไปรษณีย์ไทย EMS ✨ ขอบคุณค่ะ 💗",
      items: {
        create: [
          { name: "เสื้อยืดลายหมี สีครีม (Size M)", qty: 1, price: 350 },
          { name: "กางเกงขายาว สีน้ำตาล (Size M)", qty: 1, price: 450 },
        ],
      },
    },
  });

  const count = await prisma.order.count({ where: { storeId: store.id } });
  console.log(`✅ Seeded store "${store.slug}" + ${count} orders`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
