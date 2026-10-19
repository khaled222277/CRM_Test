import { useId, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

/** Native select, styled to match Field. Native beats a custom listbox here. */
export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-[13px] font-medium text-ink-700">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "block w-full appearance-none rounded-md border bg-white px-3 py-2 text-sm text-ink-800",
          "bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-accent-500/30",
          error ? "border-danger-600" : "border-ink-300 focus:border-accent-500",
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%236b7480' stroke-width='1.6' stroke-linecap='round'%3E%3Cpath d='m4 6.5 4 4 4-4'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[13px] text-danger-600">{error}</p>}
    </div>
  );
}
