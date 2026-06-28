"use client";

import { useEffect, useState, useTransition } from "react";
import type { LineSettingsView } from "@/lib/settings";
import { updateLineSettings, sendLineTest } from "@/app/admin/actions";

const inputBase =
  "rounded-xl border border-pinksoft bg-cream px-3 py-2 text-sm text-brown outline-none focus:border-pink";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-brown">{label}</span>
      {children}
      {hint && <span className="text-xs text-brown/50">{hint}</span>}
    </label>
  );
}

export function LineSettingsForm({ initial }: { initial: LineSettingsView }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelToken, setChannelToken] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();

  // webhook URL ขึ้นกับโดเมนจริง — คำนวณฝั่ง client
  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/line/webhook`);
  }, []);

  function save() {
    setError(null);
    setSaved(false);
    setTestMsg(null);
    startTransition(async () => {
      const res = await updateLineSettings({ enabled, channelToken, channelSecret });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setChannelToken("");
      setChannelSecret("");
      setSaved(true);
    });
  }

  function test() {
    setTestMsg(null);
    startTest(async () => {
      const res = await sendLineTest();
      setTestMsg(res.ok ? "✅ ส่งข้อความทดสอบแล้ว — เช็คใน LINE" : `⚠️ ${res.error}`);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-brown">แจ้งเตือนทาง LINE</h2>
        <StatusBadge connected={initial.connected} enabled={initial.enabled} />
      </div>

      <p className="text-xs leading-relaxed text-brown/60">
        เมื่อตั้งค่าแล้ว ร้านจะได้รับข้อความ LINE ทันทีที่ลูกค้าอัปโหลดสลิป (พร้อมลิงก์ไปตรวจสอบ)
      </p>

      {/* ขั้นตอนตั้งค่า */}
      <ol className="flex flex-col gap-1.5 rounded-xl border border-pinksoft/60 bg-cream/50 p-3 text-xs text-brown/70">
        <li>1. สร้าง LINE Official Account + Messaging API ที่ developers.line.biz</li>
        <li>2. คัดลอก <b>Channel access token</b> และ <b>Channel secret</b> มาวางด้านล่าง แล้วกดบันทึก</li>
        <li>
          3. ตั้ง <b>Webhook URL</b> ใน LINE Console เป็น:
          {webhookUrl && (
            <code className="mt-1 block break-all rounded-lg bg-white px-2 py-1 text-[11px] text-pinkdeep">
              {webhookUrl}
            </code>
          )}
          แล้วเปิด “Use webhook”
        </li>
        <li>4. แอด/ทักแชต OA ของร้าน 1 ครั้ง เพื่อให้ระบบจับบัญชีปลายทาง</li>
        <li>5. กลับมากด “ทดสอบส่ง” เพื่อยืนยัน</li>
      </ol>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-pinkdeep"
        />
        <span className="text-sm text-brown">เปิดการแจ้งเตือน LINE</span>
      </label>

      <Field
        label="Channel access token"
        hint={initial.hasToken ? "ตั้งค่าไว้แล้ว — เว้นว่างถ้าไม่ต้องการเปลี่ยน" : "ยังไม่ได้ตั้งค่า"}
      >
        <input
          className={inputBase}
          type="password"
          autoComplete="off"
          placeholder={initial.hasToken ? "••••••••  (ค่าเดิมถูกซ่อนไว้)" : "วาง token ที่นี่"}
          value={channelToken}
          onChange={(e) => setChannelToken(e.target.value)}
        />
      </Field>

      <Field
        label="Channel secret"
        hint={initial.hasSecret ? "ตั้งค่าไว้แล้ว — เว้นว่างถ้าไม่ต้องการเปลี่ยน" : "ยังไม่ได้ตั้งค่า (ใช้ยืนยัน webhook)"}
      >
        <input
          className={inputBase}
          type="password"
          autoComplete="off"
          placeholder={initial.hasSecret ? "••••••••  (ค่าเดิมถูกซ่อนไว้)" : "วาง secret ที่นี่"}
          value={channelSecret}
          onChange={(e) => setChannelSecret(e.target.value)}
        />
      </Field>

      {error && <p className="text-sm text-pinkdeep">⚠️ {error}</p>}
      {saved && <p className="text-sm text-brown">✅ บันทึกแล้ว</p>}
      {testMsg && <p className="text-sm text-brown">{testMsg}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-xl border border-pinksoft bg-blush px-5 py-2.5 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า LINE"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={testing || !initial.connected}
          title={!initial.connected ? "ต้องเชื่อม LINE (ทักแชต OA) ก่อน" : ""}
          className="rounded-xl border border-pinksoft bg-white px-5 py-2.5 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98] disabled:opacity-40"
        >
          {testing ? "กำลังส่ง…" : "ทดสอบส่ง"}
        </button>
      </div>
    </section>
  );
}

function StatusBadge({ connected, enabled }: { connected: boolean; enabled: boolean }) {
  const [text, cls] = !connected
    ? ["ยังไม่เชื่อม", "bg-pinksoft/50 text-brown/70"]
    : enabled
      ? ["พร้อมใช้งาน", "bg-brown text-white"]
      : ["เชื่อมแล้ว (ปิดอยู่)", "bg-bluesoft/50 text-brown"];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{text}</span>
  );
}
