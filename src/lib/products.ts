import { prisma } from "@/lib/prisma";

/** สินค้าในแคตตาล็อก (ไว้เลือกตอนสร้างบิล) */
export type Product = { id: string; name: string; price: number };

/** รายการสินค้าทั้งหมด เรียงตามชื่อ */
export async function listProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return rows.map((p) => ({ id: p.id, name: p.name, price: p.price }));
}
