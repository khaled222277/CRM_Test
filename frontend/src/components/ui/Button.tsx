import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  // The accent appears here and on active nav -- nowhere else.
  primary:
    "bg-accent-600 text-white border border-accent-600 hover:bg-accent-700 hover:border-accent-700 active:bg-accent-800",
  secondary:
    "bg-white text-ink-700 border border-ink-300 hover:bg-ink-50 hover:border-ink-400 active:bg-ink-100",
  ghost:
    "bg-transparent text-ink-600 border border-transparent hover:bg-ink-200/60 hover:text-ink-800",
  danger:
    "bg-white text-danger-600 border border-ink-300 hover:bg-danger-50 hover:border-danger-600",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="size-3.5 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
