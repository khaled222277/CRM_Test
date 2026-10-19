import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getErrorMessage } from "@/api/client";
import {
  useActivities,
  useContact,
  useContactDeals,
  useContactTasks,
  useDeleteContact,
} from "@/api/hooks";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { ActivityList, ActivityListSkeleton } from "@/components/activities/ActivityList";
import { IconPipeline } from "@/components/icons";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskList, TaskListSkeleton } from "@/components/tasks/TaskList";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StageBadge } from "@/components/ui/StageBadge";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatMoney } from "@/lib/format";

export function ContactDetailPage() {
  const { id } = useParams();
  const contactId = Number(id);
  const navigate = useNavigate();
  const { notify } = useToast();

  const { data: contact, isPending, isError, error } = useContact(contactId);
  const activities = useActivities({ contact_id: contactId });
  const deals = useContactDeals(contactId);
  const tasks = useContactTasks(contactId);
  const deleteContact = useDeleteContact();

  const [logOpen, setLogOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isPending) {
    return (
      <>
        <PageHeader title="Contact" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="p-5">
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-3 w-full" />
              ))}
            </div>
          </Card>
          <Card>
            <div className="border-b border-ink-200 px-5 py-4">
              <Skeleton className="h-3.5 w-32" />
            </div>
            <ActivityListSkeleton />
          </Card>
        </div>
      </>
    );
  }

  if (isError || !contact) {
    return (
      <>
        <PageHeader title="Contact" />
        <Card className="p-6">
          <Alert tone="danger" title="Couldn't load this contact">
            {getErrorMessage(error, "It may have been deleted.")}
          </Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate("/contacts")}>
              Back to contacts
            </Button>
          </div>
        </Card>
      </>
    );
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteContact.mutateAsync(contactId);
      notify("Contact deleted.");
      navigate("/contacts", { replace: true });
    } catch (err) {
      // The backend refuses while activities or tasks reference the contact,
      // and its message names the counts. Show it verbatim -- "failed to
      // delete" would hide the one thing the user needs to know.
      setDeleteError(getErrorMessage(err, "Could not delete this contact."));
    }
  }

  return (
    <>
      <div className="mb-4">
        <Link
          to="/contacts"
          className="text-[13px] text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
        >
          &larr; Contacts
        </Link>
      </div>

      <PageHeader
        title={contact.name}
        description={contact.company?.name ?? undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setLogOpen(true)}>
              Log activity
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/contacts/${contact.id}/edit`)}
            >
              Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <div className="px-5 py-2">
              <dl className="divide-y divide-ink-100">
                <Detail label="Email">
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-accent-700 underline-offset-2 hover:underline"
                    >
                      {contact.email}
                    </a>
                  ) : (
                    <span className="text-ink-400">Not set</span>
                  )}
                </Detail>
                <Detail label="Phone">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-accent-700 underline-offset-2 hover:underline"
                    >
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-ink-400">Not set</span>
                  )}
                </Detail>
                <Detail label="Company">
                  {contact.company?.name ?? <span className="text-ink-400">None</span>}
                </Detail>
                <Detail label="Added">{formatDate(contact.created_at)}</Detail>
              </dl>
              {contact.notes && (
                <div className="border-t border-ink-100 py-3">
                  <p className="text-[13px] text-ink-500">Notes</p>
                  <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-700">
                    {contact.notes}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Deals" />
            {deals.isPending ? (
              <div className="space-y-2 px-5 py-4">
                {Array.from({ length: 2 }, (_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : deals.data && deals.data.length > 0 ? (
              <ul className="divide-y divide-ink-100">
                {deals.data.map((deal) => (
                  <li key={deal.id}>
                    <Link
                      to={`/deals/${deal.id}`}
                      className="block px-5 py-3 transition-colors hover:bg-ink-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-800">
                          {deal.title}
                        </span>
                        <span className="tabular shrink-0 text-[13px] text-ink-600">
                          {formatMoney(deal.value)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <StageBadge stage={deal.stage} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<IconPipeline className="size-4.5" />}
                title="No deals yet"
                description="Open a deal for this contact from the Pipeline board."
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Tasks"
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
                  {getErrorMessage(tasks.error, "Couldn't load this contact's tasks.")}
                </Alert>
              </div>
            ) : (
              // Same row component as the Tasks page, so complete/cancel/edit/
              // delete behave identically and invalidate the same query keys.
              <TaskList
                tasks={tasks.data}
                showContact={false}
                emptyTitle="No tasks"
                emptyDescription="Tasks linked to this contact will be listed here."
              />
            )}
          </Card>
        </div>

        <Card className="flex flex-col">
          <CardHeader
            title="Activity"
            description="Every interaction logged with this contact, newest first"
            action={
              <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}>
                Log activity
              </Button>
            }
          />
          {activities.isPending ? (
            <ActivityListSkeleton rows={5} />
          ) : activities.isError ? (
            <div className="px-5 py-4">
              <Alert tone="danger">
                {getErrorMessage(activities.error, "Couldn't load this contact's activity.")}
              </Alert>
            </div>
          ) : (
            <ActivityList
              activities={activities.data}
              showContact={false}
              emptyTitle="Nothing logged with this contact"
              emptyDescription="Log a call, email or meeting to start building the history."
              maxHeightClass="max-h-[640px]"
            />
          )}
        </Card>
      </div>

      <ActivityForm
        open={logOpen}
        onClose={() => setLogOpen(false)}
        contactId={contact.id}
        contactName={contact.name}
      />

      <TaskFormDialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        defaultContact={{ id: contact.id, label: contact.name }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDelete()}
        title="Delete this contact?"
        confirmLabel="Delete contact"
        loading={deleteContact.isPending}
        error={deleteError}
        message={
          <>
            <strong className="font-medium text-ink-800">{contact.name}</strong> and any
            deals opened against them will be removed. Contacts with logged activity or
            tasks can't be deleted until those are cleared.
          </>
        }
      />
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-ink-800">{children}</dd>
    </div>
  );
}
