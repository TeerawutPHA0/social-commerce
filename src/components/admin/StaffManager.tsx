"use client";

import { useState, useTransition } from "react";
import type { StoreUser } from "@/lib/users";
import { addStaff, removeStaff } from "@/app/admin/actions";

const inputBase =
  "rounded-xl border border-pinksoft bg-cream px-3 py-2 text-sm text-brown outline-none focus:border-pink";

export function StaffManager({ users }: { users: StoreUser[] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await addStaff(email, password);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEmail("");
      setPassword("");
    });
  }

  function remove(u: StoreUser) {
    setError(null);
    if (!window.confirm(`ลบพนักงาน ${u.email}?`)) return;
    startTransition(async () => {
      const res = await removeStaff(u.id);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <h2 className="text-sm font-semibold text-brown">พนักงาน (เฉพาะเจ้าของร้านจัดการได้)</h2>

      {/* รายชื่อ */}
      <ul className="flex flex-col divide-y divide-pinksoft/50">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-brown">{u.email}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  u.role === "owner" ? "bg-brown text-white" : "bg-pinksoft text-brown"
                }`}
              >
                {u.role === "owner" ? "เจ้าของร้าน" : "พนักงาน"}
              </span>
              {u.isSelf && <span className="ml-2 text-[11px] text-brown/50">(คุณ)</span>}
            </div>
            {u.role === "staff" && !u.isSelf && (
              <button
                type="button"
                onClick={() => remove(u)}
                disabled={pending}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-pinkdeep transition active:scale-95 disabled:opacity-40"
              >
                ลบ
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* เพิ่มพนักงาน */}
      <div className="flex flex-col gap-2 border-t border-pinksoft/60 pt-3">
        <p className="text-sm font-medium text-brown">เพิ่มพนักงานใหม่</p>
        <input
          className={inputBase}
          type="email"
          autoComplete="off"
          placeholder="อีเมลพนักงาน"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={inputBase}
          type="password"
          autoComplete="new-password"
          placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-pinkdeep">⚠️ {error}</p>}
        <button
          type="button"
          onClick={add}
          disabled={pending || !email || !password}
          className="self-start rounded-xl border border-pinksoft bg-blush px-5 py-2.5 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก…" : "เพิ่มพนักงาน"}
        </button>
      </div>
    </section>
  );
}
