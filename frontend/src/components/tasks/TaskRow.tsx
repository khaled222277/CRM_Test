import { useState } from "react";
import { Link } from "react-router-dom";

import { getErrorMessage } from "@/api/client";
import { useCancelTask, useCompleteTask, useDeleteTask } from "@/api/hooks";
import type { TaskOut, TaskStatus } from "@/api/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { daysUntilDate, formatDueLabel, dueUrgency } from "@/lib/format";

import { TaskFormDialog } from "./TaskFormDialog";

export const TASK_STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  pending: "accent",
  completed: "positive",
  cancelled: "neutral",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * One task, with its actions. Used by the Tasks page and by the task sections
 * on the contact and deal detail pages, so the behaviour cannot drift between
 * them.
 *
 * `showContact` / `showDeal` are turned off on the page that already scopes by
 * that relation -- a deal's task list repeating the deal name on every row is
 * just noise.
 */
export function TaskRow({
  task,
  dealTitle,
  showContact = true,
  showDeal = true,
}: {
  task: TaskOut;
  dealTitle?: string;
  showContact?: boolean;
  showDeal?: boolean;
}) {
  const completeTask = useCompleteTask();
  const cancelTask = useCancelTask();
  const deleteTask = useDeleteTask();
  const { notify } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isClosed = task.status !== "pending";
  const days = task.due_date ? daysUntilDate(task.due_date) : null;
  // Urgency only means something while the task is still outstanding.
  const urgency = !isClosed && days !== null ? dueUrgency(days) : "neutral";
  const isOverdue = !isClosed && days !== null && days < 0;

  async function handleComplete() {
    try {
      // No confirmation: completing is low-stakes, and a dialog between the
      // click and the tick would make the common case feel slow.
      await completeTask.mutateAsync(task.id);
      notify("Task completed.");
    } catch (error) {
      notify(getErrorMessage(error, "Could not complete this task."), "error");
    }
  }

  async function handleCancel() {
    setActionError(null);
    try {
      await cancelTask.mutateAsync(task.id);
      notify("Task cancelled.");
      setCancelOpen(false);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not cancel this task."));
    }
  }

  async function handleDelete() {
    setActionError(null);
    try {
      await deleteTask.mutateAsync(task.id);
      notify("Task deleted.");
      setDeleteOpen(false);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not delete this task."));
    }
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-2 px-5 py-3.5 sm:flex-nowrap",
        isClosed && "bg-ink-50/40",
      )}
    >
      {/* A thin rail rather than a filled row -- an overdue list should read as
          a list with some urgent items, not a wall of red. */}
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 h-8 w-0.5 shrink-0 rounded-full",
          isOverdue ? "bg-danger-600" : urgency === "warn" ? "bg-warn-600" : "bg-transparent",
        )}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] leading-snug",
            isClosed ? "text-ink-500 line-through" : "font-medium text-ink-800",
          )}
        >
          {task.title}
        </p>

        {task.description && !isClosed && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-500">{task.description}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-500">
          {task.due_date ? (
            <span className={cn(isOverdue && "font-medium text-danger-600")}>
              {formatDueLabel(task.due_date)}
            </span>
          ) : (
            <span className="text-ink-400">No due date</span>
          )}

          {showContact && task.contact && (
            <>
              <span className="text-ink-300" aria-hidden="true">
                &middot;
              </span>
              <Link
                to={`/contacts/${task.contact.id}`}
                className="text-accent-700 underline-offset-2 hover:underline"
              >
                {task.contact.name}
              </Link>
            </>
          )}

          {showDeal && task.deal_id && (
            <>
              <span className="text-ink-300" aria-hidden="true">
                &middot;
              </span>
              <Link
                to={`/deals/${task.deal_id}`}
                className="text-accent-700 underline-offset-2 hover:underline"
              >
                {dealTitle ?? "View deal"}
              </Link>
            </>
          )}
        </div>
      </div>

      <Badge tone={TASK_STATUS_TONES[task.status]} className="shrink-0">
        {TASK_STATUS_LABELS[task.status]}
      </Badge>

      <div className="flex shrink-0 gap-1">
        {!isClosed && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleComplete()}
              loading={completeTask.isPending}
            >
              Complete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>
              Cancel
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
          Delete
        </Button>
      </div>

      <TaskFormDialog task={task} open={editOpen} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setActionError(null);
        }}
        onConfirm={() => void handleCancel()}
        title="Cancel this task?"
        confirmLabel="Cancel task"
        loading={cancelTask.isPending}
        error={actionError}
        message={
          <>
            <strong className="font-medium text-ink-800">{task.title}</strong> will be
            marked cancelled. It stays in your history and can still be found under the
            Cancelled filter, but it can't be reopened.
          </>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setActionError(null);
        }}
        onConfirm={() => void handleDelete()}
        title="Delete this task?"
        confirmLabel="Delete task"
        loading={deleteTask.isPending}
        error={actionError}
        message={
          <>
            <strong className="font-medium text-ink-800">{task.title}</strong> will be
            removed for good. Cancelling instead keeps a record of it.
          </>
        }
      />
    </li>
  );
}
