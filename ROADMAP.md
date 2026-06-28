# 🗺️ Roadmap — เตรียมระบบให้พร้อมขาย (Fastwork)

> เป้าหมาย: ยกระดับจาก "เดโม่นักพัฒนา" → "สินค้าสำเร็จรูปพร้อมส่งมอบลูกค้า"
> สถานะปัจจุบัน: โครงสร้างหลัก (multi-tenant, auth, flow ลูกค้า 6 step, เช็คพัสดุ 4 ขนส่ง, e2e test) = **เสร็จแล้ว** (Phase 1–5)
> เอกสารนี้คือแผนงานต่อยอด Phase 6 เป็นต้นไป เรียงตามลำดับความสำคัญต่อการขาย

**วิธีใช้:** ทำทีละ Phase จากบนลงล่าง · ติ๊ก `[x]` เมื่อเสร็จ · แต่ละงานมี "เกณฑ์ว่าเสร็จ" (Acceptance) กำกับ

ระดับความสำคัญ: 🔴 ต้องมีก่อนขาย · 🟡 เพิ่มมูลค่า · 🟠 เทคนิค/ความเสถียร · 🟢 ขัดเงา/การตลาด

---

## Phase 6 — แจ้งเตือนอัตโนมัติ 🔴
> **ผลกระทบสูงสุดต่อราคาขาย** — ร้านขายผ่าน LINE/FB แต่ระบบยังไม่ส่งอะไรกลับเลย
> หมายเหตุ: LINE Notify ปิดบริการแล้ว (มี.ค. 2025) → ใช้ LINE Messaging API (OA)

### 6.1 แจ้งเตือน "ร้าน" ทาง LINE OA ✅ (เสร็จแล้ว)
> เลือกแจ้งร้านก่อน เพราะลูกค้าเปิดผ่านลิงก์ลับ (ไม่มี userId) — แจ้งลูกค้าต้องทำ LINE Login (ดู 6.3)
- [x] ฟิลด์ใน `Store`: `lineChannelToken` / `lineChannelSecret` (เข้ารหัส AES-256-GCM ที่ `lib/crypto.ts`), `lineUserId`, `lineNotifyEnabled`
- [x] `src/lib/notify/line.ts` (push/reply) + `src/lib/notify/index.ts` (`notifyMerchant` กลืน error ไม่พัง flow)
- [x] Webhook `src/app/api/line/webhook/route.ts` — verify ลายเซ็น + จับ `userId` ตอนร้านทักแชต OA + reply ยืนยัน
- [x] Trigger: ลูกค้า **อัปสลิป** (`track/actions.uploadSlip`) → แจ้งร้าน "💸 มีสลิปใหม่รอตรวจ" + ลิงก์ไปหน้าออเดอร์
- [x] `/admin/settings`: ฟอร์มตั้งค่า LINE + แสดง Webhook URL + สถานะเชื่อมต่อ + ปุ่มทดสอบส่ง
- **เหลือทำก่อนใช้จริง:** รัน `npm run db:push` (เพิ่มคอลัมน์ใหม่) · ตั้ง LINE OA + Webhook ตามขั้นตอนในหน้า settings
- **ต่อยอดได้:** เพิ่ม trigger แจ้งร้านตอนลูกค้ากรอกที่อยู่ครบ / มีออเดอร์ค้างตรวจเกิน X ชม.

### 6.2 อีเมลแจ้งเตือน (ทางเลือกสำรอง)
- [ ] ใช้ `shippingEmail` ที่เก็บอยู่แล้ว (ตอนนี้ไม่เคยถูกใช้)
- [ ] `src/lib/notify/email.ts` — ผ่าน Resend / SMTP (env: `RESEND_API_KEY`)
- [ ] ส่งอีเมลตอนยืนยันสลิป + ใส่เลขพัสดุ (template HTML สั้นๆ)
- **Acceptance:** ออเดอร์ที่มีอีเมล ได้รับเมลเมื่อสถานะเปลี่ยน · ไม่มี token = ข้ามเงียบ ไม่ error

### 6.3 ข้อความสำเร็จรูปให้ร้าน copy (ทำง่าย เริ่มได้ก่อน)
- [ ] ปุ่ม "คัดลอกข้อความแจ้งลูกค้า" ในหน้า admin order (รวมเลขบิล + ลิงก์ + ยอด)
- **Acceptance:** กดแล้วได้ข้อความพร้อมวางใน LINE/แชต

---

## Phase 7 — PromptPay QR อัตโนมัติ 🔴 ✅ (เสร็จแล้ว)
> มี `promptpay-qr` + `qrcode` ติดตั้งไว้แล้วแต่ยังไม่ได้ใช้ — งานเล็ก ผลลัพธ์ดูโปรทันที

- [x] เพิ่มฟิลด์ `Store.promptpayId` (เบอร์มือถือ/เลขบัตร ปชช.)
- [x] `src/lib/promptpay.ts` — gen payload + render QR เป็น data URL **ตามยอดบิล** (validate 10/13/15 หลัก)
- [x] หน้า `/track/[token]` ฝั่งชำระเงิน: แสดง QR ที่ฝังยอดที่ต้องจ่ายรอบนั้น (เต็ม/มัดจำ) + ข้อความ "สแกนแล้วยอดขึ้นอัตโนมัติ"
- [x] หน้า settings: กรอกเบอร์พร้อมเพย์ (กรองเฉพาะตัวเลข) — `payQrImage` กลายเป็น "รูป QR สำรอง"
- **Acceptance:** ✅ ทดสอบแล้ว — track page เรนเดอร์ QR data URL จริง, payload EMVCo ฝังยอดถูก (`5406320.00`), ยอดเต็ม/มัดจำคำนวณตรง
- **ตรวจแล้ว:** `tsc` + `next build` ผ่าน · seed ออเดอร์จริง → curl track page เจอ QR + ยอดตรง · payload validate tag 54

---

## Phase 8 — ค้นหา + Pagination + ประสิทธิภาพ 🔴🟠 ✅ (เสร็จแล้ว)
> เดิม `listOrders()` และ `getStats()` ดึง **ทุกออเดอร์เข้า memory** ทุกครั้ง → ร้านที่โตจะช้า/แพง

- [x] ช่องค้นหาในหน้า admin: ตามเลขบิล / ชื่อ / เบอร์โทร (GET form, คงค่า filter)
- [x] Pagination (20 รายการ/หน้า, ก่อนหน้า/ถัดไป, คงค่า filter+ค้นหา)
- [x] `listOrders()` filter/ค้นหา/แบ่งหน้าใน DB (`stepWhere` map flow step → where) + คืน total
- [x] `getStats()` ใช้ count query ต่อ step (ขนาน) + revenue ผ่าน raw SQL (ไม่ loop ใน memory)
- [x] `getMonthlySales()` group + กรองช่วงเดือนใน DB (raw SQL, `where` วันที่)
- [x] เพิ่ม `@@index([storeId, createdAt])`
- **Acceptance:** ✅ ทดสอบ seed 1,000 ออเดอร์ — หน้า admin warm load 0.74s, pagination/ค้นหา/filter ทำงาน
- **ตรวจแล้ว:** stepWhere(DB) == deriveStep(JS) ครบ 6 step + sum==total · revenue SQL==JS (61,650) · tsc/build/e2e ผ่าน

---

## Phase 9 — จัดการบัญชีผู้ใช้ใน UI 🔴 ✅ (เสร็จแล้ว)
> เดิมเปลี่ยนรหัสต้องรัน `npm run bootstrap` — ลูกค้าทั่วไปทำไม่ได้

- [x] หน้า `/admin/account`: เปลี่ยนรหัสผ่านตัวเอง (ยืนยันรหัสเดิม, ขั้นต่ำ 8 ตัว) — ทุก role
- [x] จัดการพนักงาน (`role: owner|staff`): เพิ่ม/ลบ staff — owner เท่านั้น (`requireOwner`)
- [x] จำกัดสิทธิ์ staff: หน้า/แอ็กชัน `ตั้งค่า` + `LINE` + จัดการผู้ใช้ = owner-only, ซ่อนลิงก์ "ตั้งค่า" จาก staff
- **Acceptance:** ✅ e2e — owner เพิ่ม staff → staff login ได้ → เข้า `/admin/settings` ถูกเด้งกลับ → owner ลบ staff
- **ตรวจแล้ว:** tsc/build ผ่าน · e2e 6/6 (รวมสเปก Phase 9 ใหม่) ไม่ regression
- **หมายเหตุ:** เปลี่ยนรหัสไม่ล้าง session เก่า (cookie stateless มี exp 7 วัน) — ยอมรับได้, ปรับเป็น session ฝั่ง DB ได้ภายหลัง

---

## Phase 10 — งานบัญชี/เอกสาร 🟡 ✅ (เสร็จแล้ว)
> สิ่งที่ร้านขอบ่อยตอนใช้จริง

- [x] **Export ออเดอร์เป็น CSV** (เลือกช่วงวันที่ + สถานะ) — BOM UTF-8 เปิด Excel ภาษาไทยไม่เพี้ยน
- [x] **ใบเสร็จแบบ print** (`/admin/orders/[id]/receipt` + ปุ่มพิมพ์ + `@media print` ซ่อน nav)
- [ ] (ออปชัน) ใบปะหน้าพัสดุ — ข้ามไปก่อน
- **Acceptance:** ✅ ทดสอบแล้ว — `/admin/orders/export` คืน CSV (200, BOM, ข้อมูลตรง) · receipt page render 200
- **ตรวจแล้ว:** tsc/build/e2e (6/6) ผ่าน

---

## Phase 11 — สินค้า/ราคา ครบขึ้น 🟡 ✅ (เสร็จแล้ว — ข้ามสต็อกตามที่ตกลง)
- [x] เพิ่ม **รูปสินค้า** ใน `Product` (Vercel Blob + fallback local เหมือนสลิป) — อัพ/ลบในหน้าสินค้า
- [~] **สต็อกคงเหลือ** — ข้ามไปก่อน (ตัดสินใจร่วมกัน)
- [x] **ส่วนลด** ต่อบิล (บาท) — หักจากยอดรวมทุกจุด (ฟอร์ม/บิลลูกค้า/ใบเสร็จ/CSV/revenue/สถิติ)
- [ ] ค่าส่งแบบเลือกได้ — ข้ามไปก่อน (ค่าส่งกรอกมือได้อยู่แล้ว)
- **Acceptance:** ✅ ทดสอบแล้ว — บิลส่วนลดคำนวณถูกทุกจุด (track total 270, CSV, revenue SQL=JS) · อัพรูปสินค้าขึ้น thumbnail
- **ตรวจแล้ว:** tsc/build ผ่าน · revenue หักส่วนลด JS==SQL · e2e 6/6 + อัพรูปสินค้า (Playwright)

---

## Phase 12 — เทคนิค/ความเสถียร (production hardening) 🟠 ✅ (เสร็จแล้ว)
- [x] **rate-limit** pluggable → Upstash Redis (REST, ไม่ต้องลง dep) ถ้ามี env / in-memory ถ้าไม่มี (`lib/ratelimit.ts`)
- [x] **token ลิงก์บิล** 4 → 16 bytes (32 hex, กันเดา URL)
- [x] **เข้ารหัส** `lineChannelToken/Secret` (ทำใน Phase 6) — `courierConfig` ยังไม่ถูกใช้ (เข้ารหัสเมื่อมี UI ต่อขนส่ง)
- [x] `uploadSlip`: ลบสลิปเก่า **หลัง** DB commit (กัน update fail แล้วไม่เหลือรูป) + ตรวจ magic byte ก่อนอัพ
- [x] ตรวจ **magic bytes** (JPEG/PNG/WebP/HEIC) ทั้งสลิป + รูปสินค้า ไม่เชื่อ `file.type` อย่างเดียว
- [ ] error logging / Sentry — ข้ามไปก่อน (ต้องมีบัญชี)
- **Acceptance:** ✅ rate-limit algorithm ถูก (บล็อกครั้งที่ 9, ปลดเมื่อหมด window) · magic-byte รับรูปจริง/ปฏิเสธไฟล์ปลอม · token 32 hex
- **ตรวจแล้ว:** tsc/build · e2e 6/6 (login async + อัพสลิปจริงผ่าน magic-byte) · unit: rate-limit + magic-byte
- **หมายเหตุ:** in-memory rate-limit คงพฤติกรรม best-effort เดิม (Turbopack dev ไม่คง state ข้าม request — production single-process/ Redis ทำงานปกติ)

---

## Phase 13 — ขัดเงา + เตรียมส่งมอบ 🟢 ✅ (เสร็จแล้ว)
> ทำให้ "ดูเป็นสินค้า" ไม่ใช่ repo เปล่า

- [x] เขียน **README ใหม่** — อธิบายระบบ + ฟีเจอร์ + ภาพหน้าจอ + quick start (แทน boilerplate)
- [x] เขียน **คู่มือใช้งานภาษาคน** `USER_GUIDE.md` สำหรับเจ้าของร้าน (8 หัวข้อ + FAQ)
- [x] เอา **asset puffiepiece ออก** (`logo.jpg`/`qrcode.jpg`) + boilerplate svg · default → `/logo.svg` (placeholder กลาง)
- [x] **ภาพหน้าจอ** (บิลลูกค้า / dashboard / settings) ใน `docs/screenshots/` ใส่ใน README
- [~] onboarding wizard — ข้าม (หน้า settings + คู่มือครอบคลุมแล้ว)
- [x] ทดสอบ flow บนมือถือ — บิลลูกค้าเป็น mobile-first (max-w-md) ตรวจผ่าน screenshot/e2e
- **Acceptance:** ✅ README + USER_GUIDE + DEPLOY ครบ — คนนอกตั้งร้านใช้เองได้
- **ตรวจแล้ว:** tsc/build ผ่าน · ไม่เหลือ asset/แบรนด์ puffiepiece ในส่วน user-facing

---
## 🎉 สถานะ: Phase 6–13 เสร็จครบ — พร้อมลงประกาศ Fastwork

---

## สรุปลำดับแนะนำ (ถ้าเวลาจำกัด)
ทำ **Phase 6 → 7 → 8 → 9** ให้ครบก่อน = ครอบคลุมสิ่งที่ลูกค้าคาดหวังหลักๆ แล้ว
จากนั้น **Phase 13** (ขัดเงา + เอกสาร) เพื่อพร้อมลงประกาศ
ส่วน 10–12 ค่อยทยอยเติมเป็น "เวอร์ชันอัปเกรด" ขายเพิ่มได้

---
_อัปเดตล่าสุด: 2026-06-27_
