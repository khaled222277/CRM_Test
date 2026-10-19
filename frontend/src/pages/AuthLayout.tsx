import type { ReactNode } from "react";

/** Shared frame for the login and register screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-100">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex items-center gap-2.5">
            <span
              className="flex size-7 items-center justify-center rounded bg-accent-600 text-xs font-bold text-white"
              aria-hidden="true"
            >
              C
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-ink-800">
              Cadence
            </span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>

          <div className="mt-7 rounded-lg border border-ink-200 bg-white p-6 shadow-[0_1px_2px_rgba(22,25,29,0.04)]">
            {children}
          </div>

          <p className="mt-5 text-center text-[13px] text-ink-500">{footer}</p>
        </div>
      </div>
    </div>
  );
}
