import { useEffect, useState, type FormEvent } from "react";

import { getErrorMessage } from "@/api/client";
import { useCreateActivity } from "@/api/hooks";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { dateTimeLocalToIso, toDateTimeLocalValue } from "@/lib/format";

const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
];

/**
 * Log-activity dialog, used from both the deal page and the contact page.
 *
 * `contactId` is always required by the API; `dealId` is passed only from the
 * deal page. The backend rejects a deal that belongs to a different contact
 * with a 400, so both callers must pass a matching pair -- which they do, since
 * the deal page reads the contact straight off the deal.
 */
export function ActivityForm({
  open,
  onClose,
  contactId,
  contactName,
  dealId,
  dealTitle,
}: {
  open: boolean;
  onClose: () => void;
  contactId: number;
  contactName: string;
  dealId?: number;
  dealTitle?: string;
}) {
  const createActivity = useCreateActivity();
  const { notify } = useToast();

  const [type, setType] = useState("call");
  const [content, setContent] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [error, setError] = useState<string | null>(null);

  // Reset on open so a reopened dialog never shows the last entry, and the
  // default time is "now" at open rather than whenever the page mounted.
  useEffect(() => {
    if (!open) return;
    setType("call");
    setContent("");
    setOccurredAt(toDateTimeLocalValue(new Date()));
    setError(null);
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await createActivity.mutateAsync({
        type,
        content: content.trim(),
        occurred_at: dateTimeLocalToIso(occurredAt),
        contact_id: contactId,
        ...(dealId ? { deal_id: dealId } : {}),
      });
      notify("Activity logged.");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not log this activity."));
    }
  }

  const subject = dealTitle ? `${dealTitle} · ${contactName}` : contactName;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log activity"
      description={subject}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={createActivity.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="activity-form"
            loading={createActivity.isPending}
            disabled={content.trim().length === 0}
          >
            Log activity
          </Button>
        </>
      }
    >
      <form id="activity-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Select label="Type" value={type} onChange={(event) => setType(event.target.value)}>
          {ACTIVITY_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Textarea
          label="What happened"
          rows={4}
          placeholder="Talked through the renewal terms..."
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
        />

        <Field
          label="When"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
          hint="Defaults to now. Backdate it if you're catching up."
          required
        />
      </form>
    </Modal>
  );
}
