import type { ActivityOut } from "@/api/types";
import { ACTIVITY_ICONS, IconInbox, IconNote } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatDateTime, relativeTime } from "@/lib/format";

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

/**
 * The activity timeline, shared by the deal and contact detail pages.
 *
 * `showContact` is off on the contact page, where every row would otherwise
 * repeat the name in the header two inches above it.
 */
export function ActivityList({
  activities,
  showContact = true,
  emptyTitle = "Nothing logged yet",
  emptyDescription = "Calls, emails, meetings and notes will appear here.",
  maxHeightClass = "max-h-[420px]",
}: {
  activities: ActivityOut[];
  showContact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  maxHeightClass?: string;
}) {
  if (activities.length === 0) {
    return (
      <EmptyState
        compact
        icon={<IconInbox className="size-4.5" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className={cn("divide-y divide-ink-100 overflow-y-auto", maxHeightClass)}>
      {activities.map((activity) => {
        const Icon =
          ACTIVITY_ICONS[activity.type as keyof typeof ACTIVITY_ICONS] ?? IconNote;

        return (
          <li key={activity.id} className="flex gap-3 px-5 py-3.5">
            <span
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500"
              aria-hidden="true"
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-ink-800">{activity.content}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-500">
                {showContact && (
                  <>
                    <span className="font-medium text-ink-600">{activity.contact.name}</span>
                    <span className="text-ink-300" aria-hidden="true">
                      &middot;
                    </span>
                  </>
                )}
                <span>{ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}</span>
                <span className="text-ink-300" aria-hidden="true">
                  &middot;
                </span>
                <time dateTime={activity.occurred_at} title={formatDateTime(activity.occurred_at)}>
                  {relativeTime(activity.occurred_at)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-ink-100">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex gap-3 px-5 py-3.5">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-40" />
          </div>
        </li>
      ))}
    </ul>
  );
}
