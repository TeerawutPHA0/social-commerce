import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/* Unit tests (logic ล้วน ไม่แตะ DB/เครือข่าย) — รันด้วย `npm test`
   e2e (Playwright) แยกต่างหากที่ `npm run e2e` */
export default defineConfig({
  resolve: {
    alias: {
      // path alias เดียวกับ tsconfig
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // โมดูล server-only โยน error เมื่อ import นอก RSC — stub ให้เป็น no-op ตอนเทส
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
