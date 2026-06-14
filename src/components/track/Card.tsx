import type { ReactNode } from "react";

/** การ์ดสีขาวขอบมน เงานุ่ม — บล็อกข้อมูลแต่ละส่วนของบิล */
export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(86,62,50,0.06)] ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-base font-semibold text-brown">{title}</h2>
      )}
      {children}
    </section>
  );
}
