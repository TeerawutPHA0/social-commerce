"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export function LoginForm({ storeName }: { storeName: string }) {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brown">Admin · {storeName}</h1>
        <p className="mt-1 text-sm text-brown/60">เข้าสู่ระบบจัดการออเดอร์</p>
      </div>

      <form action={action} className="w-full rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(86,62,50,0.08)]">
        <label className="block text-sm font-medium text-brown" htmlFor="email">
          อีเมล
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          className="mt-2 w-full rounded-xl border border-pinksoft bg-cream px-4 py-3 text-brown outline-none focus:border-pink"
          placeholder="you@example.com"
        />

        <label className="mt-4 block text-sm font-medium text-brown" htmlFor="password">
          รหัสผ่าน
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-xl border border-pinksoft bg-cream px-4 py-3 text-brown outline-none focus:border-pink"
          placeholder="••••••••"
        />

        {state.error && (
          <p className="mt-3 text-sm text-pinkdeep">⚠️ {state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-xl border border-pinksoft bg-blush py-3 text-sm font-semibold text-brown shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
