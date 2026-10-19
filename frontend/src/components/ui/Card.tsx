import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Surface primitive.
 *
 * One hairline border and no shadow by default -- on a dense screen, stacked
 * drop-shadows read as noise. Elevation is reserved for things that genuinely
 * float (menus, drawers).
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-ink-200 bg-white",
        "shadow-[0_1px_2px_rgba(22,25,29,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  description,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-ink-800">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
