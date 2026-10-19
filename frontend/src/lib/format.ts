import { formatDistanceToNowStrict } from "date-fns";

/**
 * Parse a timestamp coming from the API.
 *
 * The backend stores UTC but serves SQLite-backed timestamps without an offset
 * ("2026-08-11T09:34:20"). `new Date()` reads an offset-less ISO string as
 * *local* time, which would skew every relative timestamp by the viewer's UTC
 * offset. Appending "Z" when no zone is present fixes that. Strings that do
 * carry an offset (as PostgreSQL will serve) pass through untouched.
 */
export function parseApiDate(value: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

/** "2 hours ago", "3 days ago". */
export function relativeTime(value: string): string {
  return `${formatDistanceToNowStrict(parseApiDate(value))} ago`;
}

/**
 * Whole days from today until a date-only string ("2026-08-14").
 *
 * Compared on calendar days in the viewer's timezone, so "tomorrow" means what
 * the user expects rather than "within the next 24 hours".
 */
export function daysUntilDate(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function formatDaysUntil(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

/**
 * How loud a date should look, given how many days away it is.
 *
 * One banding for every deadline in the app -- deal close dates on the kanban
 * cards and the dashboard's closing-soon list, and task due dates on the tasks
 * page -- so the same number of days never reads as urgent in one view and
 * calm in another. Anything in the past is already danger, since `days` is
 * negative there.
 */
export function dueUrgency(days: number): "danger" | "warn" | "neutral" {
  if (days <= 1) return "danger";
  if (days <= 3) return "warn";
  return "neutral";
}

/** Relative + absolute together, e.g. "Tomorrow · 15 Mar". */
export function formatDueLabel(isoDate: string): string {
  const days = daysUntilDate(isoDate);
  const absolute = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(
    /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
      ? new Date(`${isoDate}T00:00:00Z`)
      : parseApiDate(isoDate),
  );
  return `${formatDaysUntil(days)} · ${absolute}`;
}

/** Format a Date for an <input type="datetime-local">, which wants local time. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Turn a datetime-local value back into an ISO instant.
 *
 * The input is local wall time, so `new Date()` interprets it in the viewer's
 * zone and `toISOString()` converts it to UTC -- which is what the API stores.
 */
export function dateTimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

/** Absolute timestamp for tooltips, e.g. "11 Aug 2026, 09:34". */
export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseApiDate(value));
}

/** Date-only display for close dates and due dates, e.g. "14 Aug 2026". */
export function formatDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : parseApiDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyWithCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Money arrives as a decimal *string* ("3000.00") so cents survive JSON.
 *
 * Note the API is currency-agnostic; USD is a display assumption made here, not
 * something the backend records.
 */
export function formatMoney(value: string | number, opts?: { cents?: boolean }): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "--";
  return opts?.cents ? currencyWithCents.format(amount) : currency.format(amount);
}

/** Compact form for headline figures: 1.2M, 48.5K. */
export function formatMoneyCompact(value: string | number): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "--";
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 10_000) return `$${Math.round(amount / 1000)}K`;
  return currency.format(amount);
}

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  contacted: "Contacted",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}
