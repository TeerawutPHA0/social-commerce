import type { Metadata } from "next";
import Link from "next/link";
import { getPrivacyInfo, privacyPolicy } from "@/lib/privacy";
import { getStoreBrand } from "@/lib/settings";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว",
  description: "นโยบายการเก็บรวบรวมและใช้ข้อมูลส่วนบุคคล (PDPA)",
};

// เนื้อหาขึ้นกับค่าตั้งร้าน (แก้ที่ /admin/settings) — ต้อง render สด ไม่ prerender ตอน build
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const [info, brand] = await Promise.all([getPrivacyInfo(), getStoreBrand()]);
  const sections = privacyPolicy(info);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 pt-8 pb-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-brown">นโยบายความเป็นส่วนตัว</h1>
        <p className="text-sm text-brown/60">{brand.name}</p>
      </header>

      <div className="flex flex-col gap-5">
        {sections.map((sec) => (
          <section key={sec.heading} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-brown">{sec.heading}</h2>
            {sec.body.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-brown/80">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <Link href="/" className="text-center text-xs text-brown/40 underline">
        ← กลับหน้าแรก
      </Link>
    </main>
  );
}
