import { prisma } from "@/lib/prisma";
import { getCurrentStoreId } from "@/lib/store";

/** สินค้าในแคตตาล็อก (ไว้เลือกตอนสร้างบิล) */
export type Product = { id: string; name: string; price: number; image: string | null };

/** รายการสินค้าของร้านปัจจุบัน เรียงตามชื่อ */
export async function listProducts(): Promise<Product[]> {
  const storeId = await getCurrentStoreId();
  const rows = await prisma.product.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.image }));
}
