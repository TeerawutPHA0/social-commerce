import Link from "next/link";
import { getCurrentUser, listStoreUsers } from "@/lib/users";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { StaffManager } from "@/components/admin/StaffManager";

export default async function AccountPage() {
  const user = await getCurrentUser();
  const isOwner = user.role === "owner";
  const users = isOwner ? await listStoreUsers() : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm text-brown/60">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-brown">บัญชีผู้ใช้</h1>
      </div>

      <section className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
        <div>
          <p className="text-xs text-brown/50">เข้าสู่ระบบในชื่อ</p>
          <p className="text-sm font-medium text-brown">{user.email}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            isOwner ? "bg-brown text-white" : "bg-pinksoft text-brown"
          }`}
        >
          {isOwner ? "เจ้าของร้าน" : "พนักงาน"}
        </span>
      </section>

      <ChangePasswordForm />
      {isOwner && <StaffManager users={users} />}
    </div>
  );
}
