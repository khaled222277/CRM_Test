import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "danger" | "warn" | "info";

const TONES: Record<Tone, string> = {
  danger: "border-danger-100 bg-danger-50 text-danger-700",
  warn: "border-warn-100 bg-warn-50 text-warn-700",
  info: "border-ink-200 bg-ink-50 text-ink-700",
};

export function Alert({
  tone = "danger",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2.5 rounded-md border px-3.5 py-3 text-[13px] leading-relaxed",
        TONES[tone],
        className,
      )}
    >
      <svg
        className="mt-0.5 size-4 shrink-0"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.75" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.75v3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.1" r="0.85" fill="currentColor" />
      </svg>
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}
