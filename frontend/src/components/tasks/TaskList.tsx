import { useMemo } from "react";

import { useBoardDeals } from "@/api/hooks";
import type { TaskOut } from "@/api/types";
import { IconTasks } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

import { TaskRow } from "./TaskRow";

/**
 * Due-date order: soonest first, tasks with no due date last.
 *
 * Sorted client-side because GET /tasks orders by created_at and takes no sort
 * parameter. Fine at this scale -- the list is capped at 200 rows -- but it is
 * the reason this cannot be paginated server-side without a backend change.
 */
export function sortByDueDate(tasks: TaskOut[]): TaskOut[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date) {
      return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : b.id - a.id;
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return b.id - a.id;
  });
}

/**
 * Resolves deal ids to titles for the row links.
 *
 * TaskOut carries `deal_id` but no nested deal, unlike its nested contact. This
 * reuses the board's already-cached deal query rather than firing a request per
 * task; if that query hasn't loaded, rows fall back to a generic "View deal"
 * link. A nested deal on TaskOut would make this unnecessary.
 */
function useDealTitles(enabled: boolean): Map<number, string> {
  const { data } = useBoardDeals();
  return useMemo(
    () => new Map((enabled && data ? data : []).map((deal) => [deal.id, deal.title])),
    [enabled, data],
  );
}

export function TaskList({
  tasks,
  showContact = true,
  showDeal = true,
  emptyTitle = "No tasks",
  emptyDescription = "Tasks you create will show up here.",
  emptyAction,
  className,
}: {
  tasks: TaskOut[];
  showContact?: boolean;
  showDeal?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
}) {
  const needsDealTitles = showDeal && tasks.some((task) => task.deal_id !== null);
  const dealTitles = useDealTitles(needsDealTitles);
  const sorted = useMemo(() => sortByDueDate(tasks), [tasks]);

  if (sorted.length === 0) {
    return (
      <EmptyState
        compact
        icon={<IconTasks className="size-4.5" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <ul className={cn("divide-y divide-ink-100", className)}>
      {sorted.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          dealTitle={task.deal_id ? dealTitles.get(task.deal_id) : undefined}
          showContact={showContact}
          showDeal={showDeal}
        />
      ))}
    </ul>
  );
}

export function TaskListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-ink-100">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-start gap-3 px-5 py-3.5">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-2.5 w-40" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-7 w-40 rounded-md" />
        </li>
      ))}
    </ul>
  );
}
