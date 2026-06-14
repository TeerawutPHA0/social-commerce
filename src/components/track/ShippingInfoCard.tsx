import type { ComponentType, SVGProps } from "react";
import type { Order } from "@/types/order";
import { Card } from "./Card";
import { MailIcon, MapPinIcon, PhoneIcon, UserIcon } from "./icons";

/** ที่อยู่สำหรับจัดส่ง: ชื่อ + เบอร์โทร + ที่อยู่เต็ม + อีเมล — ทุกแถวมีไอคอน align ตรงกัน */
export function ShippingInfoCard({ order }: { order: Order }) {
  const { name, phone, address, postcode, email } = order.shipping;
  const fullAddress = postcode ? `${address} ${postcode}` : address;

  return (
    <Card title="ที่อยู่สำหรับจัดส่ง">
      <dl className="flex flex-col gap-3 text-sm">
        <Row icon={UserIcon} label="ชื่อผู้รับ">
          <span className="font-medium text-brown">{name}</span>
        </Row>
        <Row icon={PhoneIcon} label="เบอร์โทรศัพท์">
          <a href={`tel:${phone}`} className="text-brown hover:underline">
            {phone}
          </a>
        </Row>
        <Row icon={MapPinIcon} label="ที่อยู่">
          <span className="leading-relaxed text-brown">{fullAddress}</span>
        </Row>
        {email && (
          <Row icon={MailIcon} label="อีเมล">
            <span className="break-all text-brown">{email}</span>
          </Row>
        )}
      </dl>
    </Card>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pinksoft/40 text-brown">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-brown/50">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}
