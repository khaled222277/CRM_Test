import { useEffect, useMemo, useState, type FormEvent } from "react";

import { getErrorMessage } from "@/api/client";
import { useContactDeals, useCreateTask, useUpdateTask } from "@/api/hooks";
import type { TaskOut } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useContactOptions } from "@/components/ui/pickerHooks";
import {
  ComboBox,
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

/**
 * Create and edit share this dialog.
 *
 * There is deliberately no status field: the backend's TaskUpdate sets
 * extra="forbid" and omits `status`, so a status control here would 422. Status
 * moves through the complete and cancel actions on the row.
 */
export function TaskFormDialog({
  task,
  open,
  onClose,
  defaultContact,
  defaultDeal,
}: {
  task?: TaskOut;
  open: boolean;
  onClose: () => void;
  defaultContact?: SearchableOption;
  defaultDeal?: SearchableOption;
}) {
  const isEdit = Boolean(task);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { notify } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [contact, setContact] = useState<SearchableOption | null>(null);
  const [deal, setDeal] = useState<SearchableOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * The deal picker only offers deals belonging to the chosen contact, because
   * the backend rejects a mismatched pair with a 400. Constraining the options
   * means the user cannot construct that request in the first place -- the
   * error is prevented rather than reported.
   */
  const contactDeals = useContactDeals(contact?.id ?? Number.NaN);
  const dealOptions = useMemo<SearchableOption[]>(
    () =>
      (contactDeals.data ?? []).map((candidate) => ({
        id: candidate.id,
        label: candidate.title,
        sublabel: candidate.stage,
      })),
    [contactDeals.data],
  );

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    // due_date is a full timestamp on the API; the input takes a date.
    setDueDate(task?.due_date ? task.due_date.slice(0, 10) : "");
    setContact(
      task?.contact
        ? { id: task.contact.id, label: task.contact.name }
        : (defaultContact ?? null),
    );
    setDeal(defaultDeal ?? null);
    setError(null);
  }, [open, task, defaultContact, defaultDeal]);

  // Editing a task that already had a deal: resolve its title once the
  // contact's deals arrive, so the picker shows a name rather than an id.
  useEffect(() => {
    if (!open || deal || !task?.deal_id) return;
    const match = dealOptions.find((option) => option.id === task.deal_id);
    if (match) setDeal(match);
  }, [open, deal, task?.deal_id, dealOptions]);

  // A deal that belongs to the previous contact must not survive the switch.
  function handleContactChange(next: SearchableOption | null) {
    setContact(next);
    if (next?.id !== contact?.id) setDeal(null);
  }

  const saving = createTask.isPending || updateTask.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      // The API stores a datetime; a date-only input means end of that day in
      // the viewer's zone, which is what "due on the 15th" means to a person.
      due_date: dueDate === "" ? null : new Date(`${dueDate}T23:59:59`).toISOString(),
      contact_id: contact?.id ?? null,
      deal_id: deal?.id ?? null,
    };

    try {
      if (isEdit && task) {
        await updateTask.mutateAsync({ taskId: task.id, input: payload });
        notify("Task updated.");
      } else {
        await createTask.mutateAsync(payload);
        notify("Task created.");
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save this task."));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit task" : "New task"}
      description={
        isEdit ? "Mark it complete or cancelled from the task row." : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="task-form"
            variant="primary"
            loading={saving}
            disabled={!title.trim()}
          >
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Title"
          placeholder="Send the revised proposal"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <Textarea
          label="Description"
          rows={3}
          placeholder="Anything worth remembering..."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <Field
          label="Due date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          hint="Optional. Overdue tasks are surfaced on the dashboard."
        />

        <SearchableSelect
          label="Contact"
          placeholder="Search contacts..."
          value={contact}
          onChange={handleContactChange}
          useSearch={useContactOptions}
          emptyMessage="No contacts match."
          hint="Optional. Required if you want to link a deal."
        />

        <ComboBox
          label="Deal"
          placeholder={contact ? "Search this contact's deals..." : ""}
          value={deal}
          onChange={setDeal}
          options={dealOptions}
          isFetching={contactDeals.isFetching}
          filterLocally
          disabled={!contact}
          disabledMessage="Select a contact first"
          emptyMessage={
            contact ? "This contact has no deals yet." : "Select a contact first"
          }
          hint={
            contact
              ? "Only deals belonging to the selected contact are listed."
              : "Pick a contact to choose one of their deals."
          }
        />
      </form>
    </Modal>
  );
}
