"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/admin/actions";

const inputBase =
  "rounded-xl border border-pinksoft bg-cream px-3 py-2 text-sm text-brown outline-none focus:border-pink";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    if (next !== confirm) {
      setError("รหัสผ่านใหม่กับยืนยันไม่ตรงกัน");
      return;
    }
    startTransition(async () => {
      const res = await changePassword(current, next);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <h2 className="text-sm font-semibold text-brown">เปลี่ยนรหัสผ่าน</h2>
      <input
        className={inputBase}
        type="password"
        autoComplete="current-password"
        placeholder="รหัสผ่านปัจจุบัน"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <input
        className={inputBase}
        type="password"
        autoComplete="new-password"
        placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <input
        className={inputBase}
        type="password"
        autoComplete="new-password"
        placeholder="ยืนยันรหัสผ่านใหม่"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      {error && <p className="text-sm text-pinkdeep">⚠️ {error}</p>}
      {saved && <p className="text-sm text-brown">✅ เปลี่ยนรหัสผ่านแล้ว</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !current || !next || !confirm}
        className="self-start rounded-xl border border-pinksoft bg-blush px-5 py-2.5 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
      </button>
    </section>
  );
}
