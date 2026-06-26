import Link from "next/link";
import { getStoreBrand } from "@/lib/settings";

// ดึงชื่อร้านจาก settings สด ๆ ทุกครั้ง (ไม่ bake ตอน build) — เปลี่ยนชื่อร้านแล้วเห็นทันที
export const dynamic = "force-dynamic";

export default async function Home() {
  const brand = await getStoreBrand();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="rounded-full bg-pinksoft px-3 py-1 text-xs font-medium text-brown">
        {brand.name}
      </span>

      <h1 className="text-3xl font-bold tracking-tight text-brown">Social Commerce</h1>

      <p className="max-w-xs text-sm leading-7 text-brown/60">
        ระบบติดตามออเดอร์แบบ chat-first — ลูกค้าเปิดบิลจากลิงก์ในแชทได้เลย ไม่ต้องล็อกอิน
      </p>

      <Link
        href="/admin"
        className="mt-2 rounded-xl border border-pinksoft bg-blush px-6 py-3 text-sm font-semibold text-brown shadow-sm transition active:scale-95"
      >
        เข้าสู่ระบบ Admin →
      </Link>
    </main>
  );
}
