import { getStoreBrand } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const brand = await getStoreBrand();
  return <LoginForm storeName={brand.name} />;
}
