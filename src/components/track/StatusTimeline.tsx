import type { ComponentType, SVGProps } from "react";
import type { FlowStep } from "@/lib/orders";
import { FLOW_STEPS, FLOW_LABELS, flowStepIndex } from "@/lib/orders";
import { BoxIcon, CheckIcon, MapPinIcon, SearchIcon, TruckIcon, WalletIcon } from "./icons";

const STEP_ICON: Record<FlowStep, ComponentType<SVGProps<SVGSVGElement>>> = {
  address: MapPinIcon,
  payment: WalletIcon,
  verifying: SearchIcon,
  to_ship: BoxIcon,
  shipping: TruckIcon,
  delivered: CheckIcon,
};

/** Timeline 6 step — ไฮไลต์ step ปัจจุบัน (derived จากสถานะจริง) */
export function StatusTimeline({ step }: { step: FlowStep }) {
  const current = flowStepIndex(step);

  return (
    <div className="rounded-2xl bg-white p-5 pb-6 shadow-[0_2px_12px_rgba(86,62,50,0.06)]">
      <p className="mb-5 text-center text-sm text-brown/60">
        สถานะออเดอร์{" "}
        <span className="font-semibold text-brown">{FLOW_LABELS[step]}</span>
      </p>

      <ol className="flex items-start">
        {FLOW_STEPS.map((s, i) => {
          const Icon = STEP_ICON[s];
          const done = i < current;
          const isCurrent = i === current;
          const active = done || isCurrent;

          return (
            <li key={s} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span
                  className={`h-1 flex-1 rounded-full ${
                    i === 0 ? "opacity-0" : i <= current ? "bg-brown" : "bg-pinksoft/40"
                  }`}
                />
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                    active
                      ? "bg-bluesoft text-brown shadow-[0_4px_10px_rgba(123,167,191,0.4)]"
                      : "border-2 border-pinksoft/50 bg-white text-brown/25"
                  } ${isCurrent ? "ring-4 ring-pinksoft" : ""}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`h-1 flex-1 rounded-full ${
                    i === FLOW_STEPS.length - 1
                      ? "opacity-0"
                      : i < current
                        ? "bg-brown"
                        : "bg-pinksoft/40"
                  }`}
                />
              </div>

              <span
                className={`mt-2 text-center text-[10px] leading-tight ${
                  active ? "font-semibold text-brown" : "text-brown/40"
                }`}
              >
                {FLOW_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
