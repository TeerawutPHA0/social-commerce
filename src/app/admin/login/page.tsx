import { getStoreBrand } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

// ดึงชื่อร้านจาก settings สด ๆ ทุกครั้ง (ไม่ bake ตอน build)
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const brand = await getStoreBrand();
  return <LoginForm storeName={brand.name} />;
}
