import Link from "next/link";
import { listProducts } from "@/lib/products";
import { ProductManager } from "@/components/admin/ProductManager";

export default async function ProductsPage() {
  const products = await listProducts();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-sm text-brown/60">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-brown">สินค้าของร้าน ({products.length})</h1>
      </div>
      <p className="text-xs text-brown/50">
        บันทึกสินค้า + ราคาไว้ที่นี่ เวลาสร้างบิลจะเลือกจาก dropdown ได้เลย ไม่ต้องพิมพ์ใหม่ทุกครั้ง
      </p>
      <ProductManager products={products} />
    </div>
  );
}
