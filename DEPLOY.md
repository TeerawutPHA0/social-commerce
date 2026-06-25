# 🚀 Deploy ขึ้น Vercel + Neon (Postgres)

โปรเจกต์นี้ใช้ **Postgres (Neon)** + เก็บรูปสลิปบน **Vercel Blob** (เพราะ Vercel เขียนไฟล์ลง disk ไม่ได้) และเป็น **multi-tenant** (หลายร้านในระบบเดียว — ออเดอร์/สินค้า/ผู้ใช้ผูกกับ `Store`) ทำตามขั้นตอนนี้ได้เลย

---

## 1. สร้าง Database ที่ Neon
1. สมัคร/เข้า https://neon.tech → **Create Project** (เลือก region สิงคโปร์ `ap-southeast-1` ใกล้ไทยสุด)
2. ไปที่ **Connection Details** → เลือก **"Pooled connection"** (สำคัญ! กัน connection เต็มบน serverless)
3. คัดลอก connection string มา หน้าตาแบบ:
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

## 2. ทดสอบบนเครื่องก่อน (แนะนำ)
1. แก้ `.env` → วาง `DATABASE_URL` เป็น string จาก Neon (ขั้นที่ 1) + `BLOB_READ_WRITE_TOKEN` (ดูขั้นที่ 1.5)
2. สร้าง/อัปเดตตารางบน Neon:
   - **DB ว่าง / มีแต่ข้อมูล demo:** `npm run db:push` แล้ว `npx tsx prisma/seed.ts`
   - **DB มีออเดอร์จริงอยู่แล้ว (อัปเกรดเป็น multi-tenant):** รัน migration ที่ preserve ข้อมูลด้วย **direct connection** (ไม่ใช่ pooled):
     ```bash
     DATABASE_URL="<direct-url>" npx tsx prisma/migrate-to-multitenant.ts
     npx prisma db push   # ยืนยันว่า schema sync (ควรขึ้น already in sync)
     ```
3. สร้าง owner user สำหรับ login (Phase 2 — login ด้วย email + password):
   ```bash
   ADMIN_EMAIL="me@example.com" ADMIN_PASSWORD="..." npm run db:create-owner
   ```
   (ถ้ารัน `db:seed` โดยตั้ง `ADMIN_EMAIL`+`ADMIN_PASSWORD` ใน .env ไว้ ก็จะสร้าง owner ให้เลย)
4. ลองรัน: `npm run dev` → เข้า http://localhost:3000/admin → login ด้วย `ADMIN_EMAIL` + `ADMIN_PASSWORD`

## 1.5 สร้าง Vercel Blob store (เก็บรูปสลิป)
1. Vercel dashboard → **Storage → Create → Blob**
2. Connect เข้า project → Vercel จะเพิ่ม `BLOB_READ_WRITE_TOKEN` ให้อัตโนมัติ
3. โลคัล: copy token นั้นมาใส่ `.env` เพื่อทดสอบอัปสลิปบนเครื่อง

## 3. ขึ้น GitHub
```bash
git add -A
git commit -m "ready for deploy"
git branch -M main
git remote add origin https://github.com/<ชื่อคุณ>/<repo>.git
git push -u origin main
```
> `.env` ไม่ถูก push (อยู่ใน .gitignore แล้ว) — secret ปลอดภัย

## 4. Deploy บน Vercel
1. เข้า https://vercel.com → **Add New → Project** → เลือก repo จาก GitHub
2. **Environment Variables** — ใส่ให้ครบ (ดูรายการใน `.env.example`):

   | ตัวแปร | ค่า |
   |--------|-----|
   | `DATABASE_URL` | connection string (Pooled) จาก Neon |
   | `BLOB_READ_WRITE_TOKEN` | เพิ่มอัตโนมัติเมื่อ connect Blob store (ขั้นที่ 1.5) |
   | `ADMIN_EMAIL` | อีเมล owner สำหรับ login (ใช้ตอน bootstrap user) |
   | `ADMIN_PASSWORD` | รหัสผ่าน owner (ตั้งใหม่ให้ปลอดภัย) |
   | `SESSION_SECRET` | สุ่มยาวๆ เช่น `openssl rand -hex 32` |
   | `THAILANDPOST_API_KEY` | (ออปชัน) ถ้าจะใช้ auto-track ไปรษณีย์ไทย |
   | `FLASH_*` / `JT_*` / `KERRY_*` | (ออปชัน) ถ้ามีบัญชี merchant ของขนส่งนั้น |

3. กด **Deploy** — build = `next build` (ตารางถูกสร้างไว้แล้วตอนขั้นที่ 2 ด้วย `npm run db:push`)

> ⚠️ **อย่าใส่ `prisma db push` ใน build script** — เพราะ Vercel ใช้ `DATABASE_URL` แบบ pooled (PgBouncer) ซึ่ง migration/DDL จะค้างเรื่อง advisory lock. สร้าง/อัปเดต schema ให้รัน `npm run db:push` บนเครื่อง (ใช้ direct connection) แทน

## 5. เช็คหลัง deploy
> หลัง deploy ครั้งแรกต้องรัน `npm run db:create-owner` (ชี้ `DATABASE_URL` ไป Neon) เพื่อสร้าง owner user ก่อน login ได้
- เข้า `https://<your-app>.vercel.app/admin` → login (email + password) → สร้างออเดอร์ทดสอบ
- เปิดลิงก์บิล → อัปสลิป → ดูว่ารูปขึ้น (เสิร์ฟจาก Vercel Blob โดยตรง)
- ดูกราฟยอดขาย / ฟิลเตอร์ / จัดการสินค้า

---

## หมายเหตุ
- **สลิปเก็บบน Vercel Blob** — `paymentSlipUrl` เก็บ public URL ของรูปตรง ๆ (Blob เติม suffix สุ่มให้ เดา URL ของออเดอร์อื่นไม่ได้) อัป/ลบผ่าน `src/lib/slip.ts`
- **Multi-tenant**: ทุกออเดอร์/สินค้าผูกกับ `storeId` — resolve ร้านจาก session ของผู้ใช้ (`src/lib/store.ts` → `getCurrentStoreId`) ทุก query/mutation ฝั่ง admin scope ตาม storeId นี้
- **Auth (Phase 2)**: login ด้วย email + password (scrypt hash ใน `User`), session เป็น signed cookie ที่ฝัง `userId`+`storeId`; ทุก server action เช็คว่า order/product เป็นของร้านตัวเองก่อนแก้
- ถ้าแก้ schema ภายหลัง: รัน `npm run db:push` (เครื่อง) หรือปล่อยให้ build บน Vercel push ให้ — ถ้าเป็นการเปลี่ยนที่อาจทำข้อมูลหาย Prisma จะ error กันไว้ (ต้องสั่ง `--accept-data-loss` เอง)
- อยากได้ migration history เป็นเรื่องเป็นราว ค่อยเปลี่ยนไปใช้ `prisma migrate` ทีหลังได้
