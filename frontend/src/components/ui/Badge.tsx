import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "warn" | "danger" | "positive";

type Tone = BadgeTone;

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-600 ring-ink-200",
  accent: "bg-accent-50 text-accent-700 ring-accent-200",
  warn: "bg-warn-50 text-warn-700 ring-warn-100",
  danger: "bg-danger-50 text-danger-700 ring-danger-100",
  positive: "bg-positive-50 text-positive-700 ring-positive-100",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5",
        "text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
