# 🚀 Deploy ขึ้น Vercel + Neon (Postgres)

โปรเจกต์นี้ย้ายจาก SQLite → **Postgres (Neon)** แล้ว และเก็บรูปสลิป **ใน DB** (เพราะ Vercel เขียนไฟล์ลง disk ไม่ได้) ทำตามขั้นตอนนี้ได้เลย

---

## 1. สร้าง Database ที่ Neon
1. สมัคร/เข้า https://neon.tech → **Create Project** (เลือก region สิงคโปร์ `ap-southeast-1` ใกล้ไทยสุด)
2. ไปที่ **Connection Details** → เลือก **"Pooled connection"** (สำคัญ! กัน connection เต็มบน serverless)
3. คัดลอก connection string มา หน้าตาแบบ:
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

## 2. ทดสอบบนเครื่องก่อน (แนะนำ)
1. แก้ `.env` → วาง `DATABASE_URL` เป็น string จาก Neon (ขั้นที่ 1)
2. สร้างตารางบน Neon:
   ```bash
   npm run db:push
   ```
3. ลองรัน: `npm run dev` → เข้า http://localhost:3000/admin (รหัสตาม `ADMIN_PASSWORD` ใน .env)

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
   | `ADMIN_PASSWORD` | รหัสผ่านแอดมิน (ตั้งใหม่ให้ปลอดภัย) |
   | `SESSION_SECRET` | สุ่มยาวๆ เช่น `openssl rand -hex 32` |
   | `THAILANDPOST_API_KEY` | (ออปชัน) ถ้าจะใช้ auto-track ไปรษณีย์ไทย |
   | `FLASH_*` / `JT_*` / `KERRY_*` | (ออปชัน) ถ้ามีบัญชี merchant ของขนส่งนั้น |

3. กด **Deploy** — build = `next build` (ตารางถูกสร้างไว้แล้วตอนขั้นที่ 2 ด้วย `npm run db:push`)

> ⚠️ **อย่าใส่ `prisma db push` ใน build script** — เพราะ Vercel ใช้ `DATABASE_URL` แบบ pooled (PgBouncer) ซึ่ง migration/DDL จะค้างเรื่อง advisory lock. สร้าง/อัปเดต schema ให้รัน `npm run db:push` บนเครื่อง (ใช้ direct connection) แทน

## 5. เช็คหลัง deploy
- เข้า `https://<your-app>.vercel.app/admin` → login → สร้างออเดอร์ทดสอบ
- เปิดลิงก์บิล → อัปสลิป → ดูว่ารูปขึ้น (เสิร์ฟจาก `/api/slip/<token>`)
- ดูกราฟยอดขาย / ฟิลเตอร์ / จัดการสินค้า

---

## หมายเหตุ
- **สลิปเก็บใน Postgres** (คอลัมน์ `paymentSlipData` แบบ bytea) เสิร์ฟผ่าน route `/api/slip/[token]` — query อื่นๆ `omit` คอลัมน์นี้ไว้ไม่ให้โหลดไบต์โดยไม่จำเป็น
- ถ้าแก้ schema ภายหลัง: รัน `npm run db:push` (เครื่อง) หรือปล่อยให้ build บน Vercel push ให้ — ถ้าเป็นการเปลี่ยนที่อาจทำข้อมูลหาย Prisma จะ error กันไว้ (ต้องสั่ง `--accept-data-loss` เอง)
- อยากได้ migration history เป็นเรื่องเป็นราว ค่อยเปลี่ยนไปใช้ `prisma migrate` ทีหลังได้
