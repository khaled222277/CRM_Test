import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getErrorMessage } from "@/api/client";
import { useOverdueTasks, useTaskList } from "@/api/hooks";
import type { TaskStatus } from "@/api/types";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskList, TaskListSkeleton } from "@/components/tasks/TaskList";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingRegion } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

type StatusFilter = TaskStatus | "all";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export function TasksPage() {
  // The dashboard's overdue stat card links here with ?overdue=true, so the
  // filter is read from the URL rather than local state alone.
  const [searchParams, setSearchParams] = useSearchParams();
  const overdueOnly = searchParams.get("overdue") === "true";

  const [status, setStatus] = useState<StatusFilter>("pending");
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const listQuery = useTaskList(status);
  const overdueQuery = useOverdueTasks(overdueOnly);

  const active = overdueOnly ? overdueQuery : listQuery;
  const tasks = active.data ?? [];

  function setOverdueOnly(next: boolean) {
    setSearchParams(next ? { overdue: "true" } : {}, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        description="What you've committed to, soonest first."
        action={
          <Button variant="primary" onClick={() => setNewTaskOpen(true)}>
            New task
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-3">
          <div
            className="flex flex-wrap gap-1"
            role="tablist"
            aria-label="Filter tasks by status"
          >
            {STATUS_TABS.map((tab) => {
              const selected = !overdueOnly && status === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  // Overdue is inherently pending-only on the backend, so the
                  // status tabs would be lying while it is on.
                  disabled={overdueOnly}
                  onClick={() => setStatus(tab.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    selected
                      ? "bg-accent-50 text-accent-700"
                      : "text-ink-600 hover:bg-ink-100 hover:text-ink-800",
                    overdueOnly && "cursor-not-allowed opacity-45 hover:bg-transparent",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-600 select-none">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => setOverdueOnly(event.target.checked)}
              className="size-3.5 rounded border-ink-300 text-accent-600 focus:ring-2 focus:ring-accent-500/30"
            />
            Overdue only
          </label>
        </div>

        {overdueOnly && (
          <p className="border-b border-ink-100 bg-warn-50/50 px-5 py-2 text-[12px] text-warn-700">
            Showing pending tasks past their due date. Clear the toggle to filter by
            status.
          </p>
        )}

        {active.isPending ? (
          <LoadingRegion label="Loading tasks">
            <TaskListSkeleton rows={5} />
          </LoadingRegion>
        ) : active.isError ? (
          <div className="px-5 py-4">
            <Alert tone="danger" title="Couldn't load your tasks">
              {getErrorMessage(active.error, "The request failed. Please try again.")}
            </Alert>
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => void active.refetch()}
                loading={active.isFetching}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <div className={cn(active.isFetching && "opacity-60")}>
            <TaskList
              tasks={tasks}
              emptyTitle={
                overdueOnly
                  ? "Nothing overdue"
                  : status === "pending"
                    ? "No pending tasks"
                    : `No ${status === "all" ? "" : status} tasks`
              }
              emptyDescription={
                overdueOnly
                  ? "Everything with a due date is still ahead of you."
                  : "Create a task to keep track of what you owe someone."
              }
              emptyAction={
                overdueOnly ? (
                  <Button variant="secondary" onClick={() => setOverdueOnly(false)}>
                    Show all tasks
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => setNewTaskOpen(true)}>
                    New task
                  </Button>
                )
              }
            />
          </div>
        )}
      </Card>

      <TaskFormDialog open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </>
  );
}
