# 🚀 Deploy ต่อลูกค้า 1 ราย (Vercel + Neon + Blob)

ระบบนี้ขายแบบ **แยก deployment ต่อลูกค้า** — ลูกค้าแต่ละเจ้าได้ระบบของตัวเองครบชุด แยกข้อมูลขาดจากกัน 100%

> **1 ลูกค้า = 1 ชุด** ประกอบด้วย: Vercel project + Neon database + Vercel Blob store + env ของตัวเอง
> ทำตามขั้นตอนด้านล่างซ้ำต่อลูกค้าใหม่แต่ละราย (ใช้เวลา ~10–15 นาที/ราย)

---

## 1. Neon — สร้าง Database
1. เข้า https://neon.tech → **Create Project** (เลือก region สิงคโปร์ `ap-southeast-1` ใกล้ไทยสุด)
2. **Connection Details** → เลือก **"Pooled connection"** (สำคัญ! กัน connection เต็มบน serverless)
3. คัดลอก connection string — หน้าตาแบบ:
   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

## 2. Vercel Blob — สร้างที่เก็บรูปสลิป
1. Vercel dashboard → **Storage → Create → Blob**
2. Connect เข้า project (ทำหลังสร้าง project ในขั้นที่ 4 ก็ได้) → Vercel เพิ่ม `BLOB_READ_WRITE_TOKEN` ให้อัตโนมัติ
3. คัดลอก token มาใส่ `.env` ด้วย เพื่อทดสอบอัปสลิปบนเครื่อง

> 💡 บนเครื่อง (local dev) ถ้าไม่ใส่ `BLOB_READ_WRITE_TOKEN` ระบบจะเก็บสลิปลง `public/uploads/` ให้อัตโนมัติ —
> แต่ **บน production ต้องมี token** เพราะ Vercel serverless เขียนไฟล์ลง disk ไม่ได้

## 3. เตรียมบนเครื่อง + ตั้งร้าน (ก่อน deploy)
1. คัดลอก `.env.example` → `.env` แล้วกรอกค่า:

   | ตัวแปร | ค่า |
   |--------|-----|
   | `DATABASE_URL` | connection string (Pooled) จากขั้น 1 |
   | `SESSION_SECRET` | สุ่มยาว ๆ: `openssl rand -hex 32` (ต้องไม่ซ้ำกันต่อลูกค้า) |
   | `STORE_NAME` | ชื่อร้านของลูกค้า (จะแสดงทั่วระบบ) |
   | `ADMIN_EMAIL` | อีเมล owner สำหรับ login |
   | `ADMIN_PASSWORD` | รหัสผ่าน owner (ตั้งให้ปลอดภัย) |
   | `BLOB_READ_WRITE_TOKEN` | จากขั้น 2 (เว้นว่างได้ถ้าแค่ทดสอบ local) |

2. สร้างตารางบน Neon:
   ```bash
   npm run db:push
   ```
3. **ตั้งร้าน + owner ในคำสั่งเดียว** (สร้างร้านเปล่า ไม่มีข้อมูล demo):
   ```bash
   npm run bootstrap
   ```
   > อ่านค่าจาก `.env` (`STORE_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD`).
   > idempotent — รันซ้ำได้ (อัปเดตชื่อร้าน/รหัส owner ให้ตรง env)
4. ลองรัน local: `npm run dev` → http://localhost:3000/admin → login ด้วย `ADMIN_EMAIL` + `ADMIN_PASSWORD`

## 4. ขึ้น GitHub + Deploy บน Vercel
1. push โค้ดขึ้น repo (`.env` ไม่ถูก push — อยู่ใน `.gitignore` แล้ว)
2. Vercel → **Add New → Project** → เลือก repo
3. **Environment Variables** — ใส่ให้ครบ:

   | ตัวแปร | จำเป็น | หมายเหตุ |
   |--------|--------|----------|
   | `DATABASE_URL` | ✅ | Pooled string จาก Neon |
   | `SESSION_SECRET` | ✅ | ค่าเดียวกับใน `.env` |
   | `BLOB_READ_WRITE_TOKEN` | ✅ | เพิ่มอัตโนมัติเมื่อ connect Blob store (ขั้น 2) |
   | `EASYSLIP_API_KEY` | ⬜ | ออปชัน — เปิดตรวจสลิปอัตโนมัติ (กันสลิปปลอม/ยอดไม่ตรง/สลิปซ้ำ) สมัครที่ easyslip.com |
   | `THAILANDPOST_API_KEY` / `FLASH_*` / `JT_*` / `KERRY_*` | ⬜ | ออปชัน — ถ้าจะใช้เช็คเลขพัสดุอัตโนมัติ |

   > `STORE_NAME` / `ADMIN_*` ไม่ต้องใส่บน Vercel ถ้ารัน `npm run bootstrap` บนเครื่องไปแล้ว (ข้อมูลอยู่ใน DB แล้ว)
4. กด **Deploy**

> ⚠️ **อย่าใส่ `prisma db push` ใน build script** — Vercel ใช้ `DATABASE_URL` แบบ pooled (PgBouncer) ซึ่ง DDL จะค้างเรื่อง advisory lock. ให้ push schema บนเครื่อง (ขั้น 3) แทน

## 5. หลัง deploy
1. เข้า `https://<app>.vercel.app/admin` → login
2. ไป **`/admin/settings`** → ตั้งค่าให้ลูกค้า: โลโก้ร้าน, บัญชี/พร้อมเพย์รับเงิน, QR, ค่าส่งเริ่มต้น
3. ทดสอบ: สร้างบิล → เปิดลิงก์บิล → อัปสลิป (ดูว่ารูปขึ้นจาก Blob) → ยืนยันการชำระเงิน

## 6. ส่งมอบลูกค้า
- URL ระบบ (`https://<app>.vercel.app/admin`) + `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- บอกว่าตั้งค่าแบรนด์/บัญชีรับเงินได้เองที่ `/admin/settings`
- ตั้ง **นโยบายความเป็นส่วนตัว (PDPA)** ที่ `/admin/settings` → กรอก "ชื่อผู้ควบคุมข้อมูล/ชื่อกิจการ" + "ช่องทางติดต่อ" (ลูกค้าเห็นที่ `/privacy` และต้องติ๊กยอมรับก่อนกรอกที่อยู่)

---

## 7. สำรองข้อมูล & กู้คืน (Backup) 🔴 สำคัญ
ข้อมูลลูกค้า (ออเดอร์/ที่อยู่/สลิป) อยู่บน Neon — **ตั้ง backup ให้ทุก deploy**

1. **Point-in-Time Restore (PITR)** — Neon เก็บ history อัตโนมัติ (ดีฟอลต์ 7 วันใน free / นานกว่าใน paid)
   - กู้คืน: Neon Console → โปรเจกต์ → **Restore** → เลือกเวลา/เลือกสร้างเป็น branch ใหม่แล้วชี้ `DATABASE_URL` ไปที่ branch นั้น
2. **สำรองด้วยมือก่อนอัปเดตสคีมา/งานเสี่ยง** (แนะนำให้ทำทุกครั้งก่อน `db push`):
   ```bash
   # ใช้ direct (ไม่ pooled) connection string ของ Neon — ดู Connection Details
   pg_dump "postgresql://USER:PASS@HOST/neondb?sslmode=require" -Fc -f backup-YYYYMMDD.dump
   # กู้คืน:
   pg_restore --clean --if-exists -d "postgresql://USER:PASS@HOST/neondb?sslmode=require" backup-YYYYMMDD.dump
   ```
3. **รูปสลิป (Vercel Blob)** สำรองแยก — ดาวน์โหลดจาก Blob dashboard เป็นระยะถ้าลูกค้าต้องเก็บหลักฐานยาว

## 8. อัปเดตสคีมาให้ลูกค้าเดิม (ที่มีข้อมูลจริงแล้ว) อย่างปลอดภัย
ระบบใช้ `prisma db push` (ไม่ใช่ `migrate`) โดยตั้งใจ เพราะ Neon pooled (PgBouncer) ทำ DDL ค้างเรื่อง advisory lock
การ push การเปลี่ยนแบบ **เพิ่มคอลัมน์/ตารางใหม่ (additive)** ปลอดภัยกับข้อมูลเดิม แต่ให้ทำตามลำดับนี้:

1. **สำรองก่อน** (ขั้น 7 ข้อ 2) — กันพลาด
2. ตรวจ diff ก่อน push (ดูว่าไม่มีการ "drop/rename" ที่ทำข้อมูลหาย):
   ```bash
   # ชี้ DATABASE_URL ไป DB ลูกค้า แล้วดูว่า push จะทำอะไร (ไม่แตะจริง)
   npx prisma db push --preview-feature 2>/dev/null || npx prisma db pull   # เทียบ schema กับ DB ปัจจุบัน
   ```
3. รัน push จริง (ใช้ direct connection ถ้า pooled ค้าง):
   ```bash
   DATABASE_URL="<direct-connection-string>" npm run db:push
   ```
   > 💡 ถ้า push เตือน *"There might be data loss … unique constraint `[storeId,slipRef]`"* แล้วหยุด —
   > เป็นเพราะ Prisma กันไว้ตอนเพิ่ม unique index. **ปลอดภัยถ้าคอลัมน์ใหม่ยังว่าง (NULL ทั้งหมด)** เช่นการอัปเดต Phase 14
   > (เพิ่ง `git pull` มา ยังไม่มีใครอัปสลิป) → รันด้วย flag นี้ได้เลย:
   > ```bash
   > DATABASE_URL="<direct-connection-string>" npx prisma db push --accept-data-loss
   > ```
   > ⚠️ แต่ถ้า DB นั้น "มีข้อมูลอยู่แล้วในคอลัมน์ที่จะเพิ่ม unique" ให้สำรอง + ตรวจค่าซ้ำก่อน (ดูข้อ 1)
4. Redeploy โค้ดบน Vercel ให้ตรงกับสคีมาใหม่
   > ⚠️ ถ้าการเปลี่ยนเป็นแบบ "ลบ/เปลี่ยนชนิดคอลัมน์ที่มีข้อมูล" — **อย่า** `db push` ตรง ๆ ให้สำรองแล้วทำเป็นขั้นตอน (เพิ่มคอลัมน์ใหม่ → ย้ายข้อมูล → ค่อยลบของเก่า)

---

## หมายเหตุ
- **ข้อมูล demo (`npm run db:seed`)** = ข้อมูลตัวอย่างของผู้พัฒนา (ร้าน puffiepiece) — **อย่ารันบน DB ของลูกค้า** ใช้ `npm run bootstrap` แทน
- **โลโก้ดีฟอลต์** `public/logo.svg` เป็นรูป placeholder กลาง ๆ — ลูกค้าตั้งโลโก้เองได้ที่ `/admin/settings` (วาง URL รูป)
- **อัปเดตโค้ดภายหลัง**: `git pull` → push → Vercel redeploy อัตโนมัติ (ถ้าแก้ schema ให้ทำตามขั้น 8 — สำรองก่อนแล้วค่อย `db push`)
- **เปลี่ยนรหัส owner**: ตั้ง `ADMIN_PASSWORD` ใหม่ใน `.env` แล้วรัน `npm run bootstrap` ซ้ำ (ยังไม่มีหน้าเปลี่ยนรหัสใน UI)
- **สถาปัตยกรรม**: ทุกออเดอร์/สินค้าผูกกับ `storeId` (multi-tenant) — แม้โมเดลนี้ deploy ละ 1 ร้าน โครงนี้ก็แยกข้อมูลให้แน่นและรองรับหลายร้านต่อ deploy ได้ในอนาคต
- **e2e test**: `npm run e2e` (ต้องมี `DATABASE_URL` ใน `.env`) — ทดสอบ data isolation + flow หลักครบ loop
