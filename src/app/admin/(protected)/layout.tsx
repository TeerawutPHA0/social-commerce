import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStoreBrand } from "@/lib/settings";
import { logoutAction } from "../actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const isOwner = session.role === "owner";
  const brand = await getStoreBrand();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-pinksoft bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-base font-bold text-brown">
              {brand.name} · Admin
            </Link>
            <Link
              href="/admin/products"
              className="text-sm font-medium text-brown/60 transition hover:text-brown"
            >
              สินค้า
            </Link>
            {isOwner && (
              <Link
                href="/admin/settings"
                className="text-sm font-medium text-brown/60 transition hover:text-brown"
              >
                ตั้งค่า
              </Link>
            )}
            <Link
              href="/admin/account"
              className="text-sm font-medium text-brown/60 transition hover:text-brown"
            >
              บัญชี
            </Link>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-pinksoft px-3 py-1.5 text-xs font-medium text-brown transition active:scale-95"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  );
}
