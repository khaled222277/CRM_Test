import { useId, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      <label htmlFor={textareaId} className="block text-[13px] font-medium text-ink-700">
        {label}
      </label>
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "block w-full rounded-md border bg-white px-3 py-2 text-sm text-ink-800",
          "placeholder:text-ink-400 resize-y",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-accent-500/30",
          error ? "border-danger-600" : "border-ink-300 focus:border-accent-500",
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-[13px] text-danger-600">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
