import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Designed empty state.
 *
 * A new account sees these before it sees anything else, so they explain what
 * the section will hold and what to do next -- never a bare "No data".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-5 py-8" : "px-6 py-12",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "mb-3 flex items-center justify-center rounded-full",
            "bg-ink-100 text-ink-400 ring-1 ring-ink-200/70",
            compact ? "size-9" : "size-11",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
