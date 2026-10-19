import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { DashboardSummary } from "@/api/types";
import { IconClock, IconContacts, IconMoney, IconTrend } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatMoneyCompact } from "@/lib/format";

function StatCard({
  label,
  value,
  detail,
  icon,
  emphasis = false,
  to,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: ReactNode;
  emphasis?: boolean;
  /** When set, the whole card becomes a link to the matching filtered view. */
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            emphasis ? "bg-danger-50 text-danger-600" : "bg-ink-100 text-ink-400",
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "tabular mt-3 text-2xl font-semibold tracking-tight",
          emphasis ? "text-danger-600" : "text-ink-900",
        )}
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-[13px] text-ink-500">{detail}</p>}
    </>
  );

  if (to) {
    return (
      <Card className="transition-colors hover:border-ink-300">
        <Link to={to} className="block rounded-lg p-5">
          {body}
        </Link>
      </Card>
    );
  }

  return <Card className="p-5">{body}</Card>;
}

export function StatCards({ summary }: { summary: DashboardSummary }) {
  const { totals, tasks } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Open pipeline"
        value={formatMoneyCompact(totals.open_pipeline_value)}
        detail="Excludes won and lost"
        icon={<IconMoney className="size-4" />}
      />
      <StatCard
        label="Open deals"
        value={String(totals.open_deals)}
        detail={`Across ${totals.companies} ${totals.companies === 1 ? "company" : "companies"}`}
        icon={<IconTrend className="size-4" />}
      />
      <StatCard
        label="Contacts"
        value={String(totals.contacts)}
        detail="People you're tracking"
        icon={<IconContacts className="size-4" />}
      />
      <StatCard
        label="Overdue tasks"
        value={String(tasks.overdue_count)}
        detail={
          tasks.due_this_week_count > 0
            ? `${tasks.due_this_week_count} more due this week`
            : "Nothing else due this week"
        }
        icon={<IconClock className="size-4" />}
        emphasis={tasks.overdue_count > 0}
        // Straight through to the same list, already filtered.
        to={tasks.overdue_count > 0 ? "/tasks?overdue=true" : "/tasks"}
      />
    </div>
  );
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-7 rounded-md" />
          </div>
          <Skeleton className="mt-3.5 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-32" />
        </Card>
      ))}
    </div>
  );
}
