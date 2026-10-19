import type { DealOut } from "@/api/types";
import { IconCalendarClock } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { dueUrgency, daysUntilDate, formatDaysUntil, formatMoney } from "@/lib/format";

function DealRow({ deal }: { deal: DealOut }) {
  // Only deals with a close date reach this list, but the type allows null.
  const days = deal.expected_close_date ? daysUntilDate(deal.expected_close_date) : null;

  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink-800">{deal.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-ink-500">{deal.contact.name}</p>
      </div>
      <p className="tabular shrink-0 text-[13px] font-medium text-ink-700">
        {formatMoney(deal.value)}
      </p>
      {days !== null && (
        <Badge tone={dueUrgency(days)} className="shrink-0">
          {formatDaysUntil(days)}
        </Badge>
      )}
    </li>
  );
}

export function ClosingSoon({ deals }: { deals: DealOut[] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title="Closing soon" description="Open deals due to close within 7 days" />
      {deals.length === 0 ? (
        <EmptyState
          compact
          icon={<IconCalendarClock className="size-4.5" />}
          title="Nothing closing this week"
          description="Deals with an expected close date in the next seven days will appear here."
        />
      ) : (
        <ul className="max-h-[420px] divide-y divide-ink-100 overflow-y-auto">
          {deals.map((deal) => (
            <DealRow key={deal.id} deal={deal} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ClosingSoonSkeleton() {
  return (
    <Card>
      <div className="border-b border-ink-200 px-5 py-4">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="mt-2 h-3 w-56" />
      </div>
      <ul className="divide-y divide-ink-100">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="flex items-center gap-3 px-5 py-3.5">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
