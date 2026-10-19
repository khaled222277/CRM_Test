import { cn } from "@/lib/cn";

/**
 * Skeleton placeholder.
 *
 * Sized by the caller to match the real content's shape, so the layout does not
 * jump when data lands. Marked aria-hidden with the live region announcing
 * "Loading" once, rather than every bar shouting at a screen reader.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden="true" style={style} className={cn("skeleton", className)} />;
}

export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Wraps a loading region so assistive tech hears one clear message. */
export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
