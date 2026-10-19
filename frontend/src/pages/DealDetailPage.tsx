import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getErrorMessage } from "@/api/client";
import {
  useActivities,
  useDeal,
  useDealTasks,
  useDeleteDeal,
  useReopenDeal,
} from "@/api/hooks";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { ActivityList, ActivityListSkeleton } from "@/components/activities/ActivityList";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskList, TaskListSkeleton } from "@/components/tasks/TaskList";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StageBadge } from "@/components/ui/StageBadge";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatMoney } from "@/lib/format";
import { isTerminalStage } from "@/lib/stages";

import { DealEditDialog } from "./deals/DealEditDialog";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-ink-800">{children}</dd>
    </div>
  );
}

export function DealDetailPage() {
  const { id } = useParams();
  const dealId = Number(id);
  const navigate = useNavigate();
  const { notify } = useToast();

  const { data: deal, isPending, isError, error } = useDeal(dealId);
  const activities = useActivities({ deal_id: dealId });
  const tasks = useDealTasks(dealId);
  const reopenDeal = useReopenDeal(dealId);
  const deleteDeal = useDeleteDeal();

  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isPending) {
    return (
      <>
        <PageHeader title="Deal" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <div className="border-b border-ink-200 px-5 py-4">
              <Skeleton className="h-3.5 w-32" />
            </div>
            <ActivityListSkeleton />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-3 w-full" />
              ))}
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (isError || !deal) {
    return (
      <>
        <PageHeader title="Deal" />
        <Card className="p-6">
          <Alert tone="danger" title="Couldn't load this deal">
            {getErrorMessage(error, "It may have been deleted.")}
          </Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate("/pipeline")}>
              Back to pipeline
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const closed = isTerminalStage(deal.stage);

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteDeal.mutateAsync(dealId);
      notify("Deal deleted.");
      navigate("/pipeline", { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Could not delete this deal."));
    }
  }

  async function handleReopen() {
    try {
      await reopenDeal.mutateAsync();
      notify("Deal reopened at Negotiation.");
    } catch (err) {
      notify(getErrorMessage(err, "Could not reopen this deal."), "error");
    }
  }

  return (
    <>
      <div className="mb-4">
        <Link
          to="/pipeline"
          className="text-[13px] text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
        >
          &larr; Pipeline
        </Link>
      </div>

      <PageHeader
        title={deal.title}
        description={formatMoney(deal.value, { cents: true })}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setLogOpen(true)}>
              Log activity
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex flex-col lg:order-2">
          <CardHeader title="Details" />
          <div className="px-5 py-2">
            <dl className="divide-y divide-ink-100">
              <DetailRow label="Stage">
                <div className="flex flex-col items-end gap-1.5">
                  <StageBadge stage={deal.stage} />
                  {closed ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleReopen()}
                      loading={reopenDeal.isPending}
                    >
                      Reopen deal
                    </Button>
                  ) : (
                    <span className="text-[11px] font-normal text-ink-400">
                      Change stage from the Pipeline board
                    </span>
                  )}
                </div>
              </DetailRow>

              <DetailRow label="Value">{formatMoney(deal.value, { cents: true })}</DetailRow>

              <DetailRow label="Probability">
                {deal.probability === null ? (
                  <span className="text-ink-400">Not set</span>
                ) : (
                  `${deal.probability}%`
                )}
              </DetailRow>

              <DetailRow label="Expected close">
                {deal.expected_close_date ? (
                  formatDate(deal.expected_close_date)
                ) : (
                  <span className="text-ink-400">Not set</span>
                )}
              </DetailRow>

              <DetailRow label="Contact">
                <Link
                  to={`/contacts/${deal.contact.id}`}
                  className="text-accent-700 underline-offset-2 hover:underline"
                >
                  {deal.contact.name}
                </Link>
              </DetailRow>

              <DetailRow label="Company">
                {deal.company ? (
                  deal.company.name
                ) : (
                  <span className="text-ink-400">None</span>
                )}
              </DetailRow>

              {deal.won_at && (
                <DetailRow label="Won">{formatDate(deal.won_at)}</DetailRow>
              )}
              {deal.lost_at && (
                <DetailRow label="Lost">{formatDate(deal.lost_at)}</DetailRow>
              )}
            </dl>
          </div>
        </Card>

        <Card className="lg:order-3 lg:col-span-2">
          <CardHeader
            title="Tasks"
            description="Work you owe on this deal"
            action={
              <Button size="sm" variant="secondary" onClick={() => setNewTaskOpen(true)}>
                New task
              </Button>
            }
          />
          {tasks.isPending ? (
            <TaskListSkeleton rows={2} />
          ) : tasks.isError ? (
            <div className="px-5 py-4">
              <Alert tone="danger">
                {getErrorMessage(tasks.error, "Couldn't load this deal's tasks.")}
              </Alert>
            </div>
          ) : (
            // Same rows and actions as the Tasks page and the contact page.
            <TaskList
              tasks={tasks.data}
              showDeal={false}
              emptyTitle="No tasks on this deal"
              emptyDescription="Add a task to track what needs doing before this closes."
            />
          )}
        </Card>

        <Card className="flex flex-col lg:order-1">
          <CardHeader
            title="Activity"
            description="Everything logged against this deal, newest first"
            action={
              <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}>
                Log activity
              </Button>
            }
          />
          {activities.isPending ? (
            <ActivityListSkeleton />
          ) : activities.isError ? (
            <div className="px-5 py-4">
              <Alert tone="danger">
                {getErrorMessage(activities.error, "Couldn't load this deal's activity.")}
              </Alert>
            </div>
          ) : (
            <ActivityList
              activities={activities.data}
              showContact={false}
              emptyTitle="No activity on this deal"
              emptyDescription="Log a call, email or meeting and it'll appear here. Stage changes are logged automatically."
              maxHeightClass="max-h-[560px]"
            />
          )}
        </Card>
      </div>

      <DealEditDialog deal={deal} open={editOpen} onClose={() => setEditOpen(false)} />

      <ActivityForm
        open={logOpen}
        onClose={() => setLogOpen(false)}
        contactId={deal.contact.id}
        contactName={deal.contact.name}
        dealId={deal.id}
        dealTitle={deal.title}
      />

      <TaskFormDialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        defaultContact={{ id: deal.contact.id, label: deal.contact.name }}
        defaultDeal={{ id: deal.id, label: deal.title }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDelete()}
        title="Delete this deal?"
        confirmLabel="Delete deal"
        loading={deleteDeal.isPending}
        error={deleteError}
        message={
          <>
            <strong className="font-medium text-ink-800">{deal.title}</strong> will be
            removed for good. Activities logged against it are kept, but they'll no longer
            be linked to a deal.
          </>
        }
      />
    </>
  );
}
