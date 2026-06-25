import Link from "next/link";
import { getStoreSettings } from "@/lib/settings";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";

export default async function SettingsPage() {
  const settings = await getStoreSettings();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm text-brown/60">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-brown">ตั้งค่าร้าน</h1>
      </div>
      <StoreSettingsForm initial={settings} />
    </div>
  );
}
