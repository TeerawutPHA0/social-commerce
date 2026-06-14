import Link from "next/link";

export default function TrackNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-pinksoft text-4xl">
        🔍
      </div>
      <h1 className="text-xl font-semibold text-brown">ไม่พบออเดอร์นี้</h1>
      <p className="text-sm leading-relaxed text-brown/60">
        ลิงก์อาจไม่ถูกต้องหรือหมดอายุแล้ว
        <br />
        กรุณาตรวจสอบลิงก์อีกครั้ง หรือทักแชทสอบถามแอดมินได้เลยค่ะ
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl border border-pinksoft bg-blush px-6 py-3 text-sm font-semibold text-brown shadow-[0_2px_10px_rgba(86,62,50,0.1)]"
      >
        กลับหน้าแรก
      </Link>
    </main>
  );
}
