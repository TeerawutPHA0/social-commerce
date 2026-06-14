import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // อนุญาตให้เปิดแอปผ่าน IP ในวง LAN (เช่นทดสอบบนมือถือ) ตอน dev
  // ไม่งั้น Next จะบล็อก dev resource/HMR ข้าม origin -> หน้าเว็บไม่ hydrate -> ปุ่มกดไม่ทำงาน
  allowedDevOrigins: ["192.168.1.47"],

  // เพิ่มลิมิต body ของ Server Action (ดีฟอลต์ 1MB) — กันสลิปจากมือถือที่บีบไม่ได้ (เช่น HEIC) เกินลิมิต
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },

  // package ฝั่ง server (pg + Prisma 7) ห้าม bundle — ให้โหลดตอน runtime
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
};

export default nextConfig;
