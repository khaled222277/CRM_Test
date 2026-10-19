import { useEffect, useState, type FormEvent } from "react";

import { getErrorMessage } from "@/api/client";
import { useCreateDeal } from "@/api/hooks";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useContactOptions } from "@/components/ui/pickerHooks";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";

export function NewDealDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createDeal = useCreateDeal();
  const { notify } = useToast();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [contact, setContact] = useState<SearchableOption | null>(null);
  const [closeDate, setCloseDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setValue("");
    setContact(null);
    setCloseDate("");
    setError(null);
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!contact) return;
    setError(null);

    try {
      // company_id is deliberately absent: the backend inherits it from the
      // contact when the field is omitted, so exposing a second picker here
      // would only let the two disagree.
      await createDeal.mutateAsync({
        title: title.trim(),
        value: value.trim() === "" ? "0" : value.trim(),
        contact_id: contact.id,
        ...(closeDate ? { expected_close_date: closeDate } : {}),
      });
      notify("Deal created.");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create this deal."));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New deal"
      description="It starts in Lead. Drag it along the board as it progresses."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={createDeal.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="new-deal-form"
            variant="primary"
            loading={createDeal.isPending}
            disabled={!title.trim() || !contact}
          >
            Create deal
          </Button>
        </>
      }
    >
      <form id="new-deal-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Title"
          placeholder="Annual renewal"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          autoFocus
        />

        <Field
          label="Value"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          hint="Leave blank for zero."
        />

        <SearchableSelect
          label="Contact"
          placeholder="Search contacts..."
          value={contact}
          onChange={setContact}
          useSearch={useContactOptions}
          emptyMessage="No contacts match. Add one from the Contacts page first."
          hint="The deal's company is taken from this contact."
          required
        />

        <Field
          label="Expected close date"
          type="date"
          value={closeDate}
          onChange={(event) => setCloseDate(event.target.value)}
          hint="Optional. Drives the countdown badge on the card."
        />
      </form>
    </Modal>
  );
}
