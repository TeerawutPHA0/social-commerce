import "server-only";
import type { Courier } from "@/types/order";
import type { CourierAdapter, TrackResult } from "./types";
import { thailandPost } from "./thailandPost";
import { flash } from "./flash";
import { jt } from "./jt";
import { kerry } from "./kerry";

export type { TrackResult, TrackEntry } from "./types";

/** ทะเบียนตัวเชื่อมขนส่ง — เพิ่มเจ้าใหม่ที่นี่ที่เดียว */
const ADAPTERS: Record<Courier, CourierAdapter> = {
  "thailand-post": thailandPost,
  kerry,
  flash,
  jt,
};

/** ตั้งค่า credentials ของขนส่งเจ้านี้ครบไหม (ไว้เปิด/ปิดปุ่มเช็คอัตโนมัติ) */
export function isCourierConfigured(courier: Courier): boolean {
  return ADAPTERS[courier]?.isConfigured() ?? false;
}

/** เช็คสถานะพัสดุของขนส่งเจ้าใดก็ได้ */
export function getTrackingStatus(courier: Courier, barcode: string): Promise<TrackResult> {
  return ADAPTERS[courier].getStatus(barcode);
}
