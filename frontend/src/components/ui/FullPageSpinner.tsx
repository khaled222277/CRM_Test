/** Shown only while an existing session is validated on cold load. */
export function FullPageSpinner({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-ink-100"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <svg className="size-5 animate-spin text-ink-400" viewBox="0 0 16 16" fill="none">
          <circle
            cx="8"
            cy="8"
            r="6.5"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2"
          />
          <path
            d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-[13px] text-ink-500">{label}</p>
      </div>
    </div>
  );
}
