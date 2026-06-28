import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getStoreSettings, getLineSettings } from "@/lib/settings";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";
import { LineSettingsForm } from "@/components/admin/LineSettingsForm";

export default async function SettingsPage() {
  await requireOwner(); // staff เข้าหน้าตั้งค่าไม่ได้ (เด้งกลับ /admin)
  const [settings, lineSettings] = await Promise.all([getStoreSettings(), getLineSettings()]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm text-brown/60">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-brown">ตั้งค่าร้าน</h1>
      </div>
      <StoreSettingsForm initial={settings} />
      <LineSettingsForm initial={lineSettings} />
    </div>
  );
}
