"use client";

import { useTransition } from "react";
import { deleteOrder } from "@/app/admin/actions";

export function DeleteOrderButton({ id, orderNo }: { id: string; orderNo: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`ลบออเดอร์ ${orderNo}? การลบนี้กู้คืนไม่ได้`)) return;
        startTransition(() => deleteOrder(id));
      }}
      className="rounded-lg px-2 py-1 text-xs font-medium text-pinkdeep transition active:scale-95 disabled:opacity-40"
    >
      {pending ? "กำลังลบ…" : "ลบ"}
    </button>
  );
}
