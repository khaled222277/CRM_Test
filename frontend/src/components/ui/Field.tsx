import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/cn";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function Field({ label, hint, error, className, id, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-[13px] font-medium text-ink-700"
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "block w-full rounded-md border bg-white px-3 py-2 text-sm text-ink-800",
          "placeholder:text-ink-400",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-accent-500/30",
          error
            ? "border-danger-600 focus:border-danger-600"
            : "border-ink-300 focus:border-accent-500",
          "disabled:bg-ink-50 disabled:text-ink-500",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-[13px] text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[13px] text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
