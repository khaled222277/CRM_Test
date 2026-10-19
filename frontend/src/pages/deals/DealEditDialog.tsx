import { useEffect, useState, type FormEvent } from "react";

import { getErrorMessage } from "@/api/client";
import { useUpdateDeal } from "@/api/hooks";
import type { DealOut } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/SearchableSelect";
import { useContactOptions } from "@/components/ui/pickerHooks";
import { useToast } from "@/components/ui/Toast";

export function DealEditDialog({
  deal,
  open,
  onClose,
}: {
  deal: DealOut;
  open: boolean;
  onClose: () => void;
}) {
  const updateDeal = useUpdateDeal(deal.id);
  const { notify } = useToast();

  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(deal.value);
  const [probability, setProbability] = useState(
    deal.probability === null ? "" : String(deal.probability),
  );
  const [closeDate, setCloseDate] = useState(deal.expected_close_date ?? "");
  const [contact, setContact] = useState<SearchableOption | null>({
    id: deal.contact.id,
    label: deal.contact.name,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(deal.title);
    setValue(deal.value);
    setProbability(deal.probability === null ? "" : String(deal.probability));
    setCloseDate(deal.expected_close_date ?? "");
    setContact({ id: deal.contact.id, label: deal.contact.name });
    setError(null);
  }, [open, deal]);

  const probabilityNumber = probability.trim() === "" ? null : Number(probability);
  const probabilityInvalid =
    probabilityNumber !== null &&
    (!Number.isInteger(probabilityNumber) || probabilityNumber < 0 || probabilityNumber > 100);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!contact || probabilityInvalid) return;
    setError(null);

    const contactChanged = contact.id !== deal.contact_id;

    try {
      // Only fields DealUpdate accepts -- it sets extra="forbid", and `stage`
      // is not among them (stage moves via PATCH /deals/{id}/stage alone).
      await updateDeal.mutateAsync({
        title: title.trim(),
        value: value.trim() === "" ? "0" : value.trim(),
        probability: probabilityNumber,
        expected_close_date: closeDate === "" ? null : closeDate,
        contact_id: contact.id,
        // Reassigning the deal to a different contact would otherwise leave the
        // old company attached. Creation inherits the company from the contact,
        // so an edit follows the same rule. `undefined` omits the key entirely.
        ...(contactChanged ? { company_id: null } : {}),
      });
      notify("Deal updated.");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save this deal."));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit deal"
      description="Stage is changed from the Pipeline board."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={updateDeal.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-deal-form"
            variant="primary"
            loading={updateDeal.isPending}
            disabled={!title.trim() || !contact || probabilityInvalid}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-deal-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <Field
          label="Value"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />

        <Field
          label="Probability"
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="e.g. 60"
          value={probability}
          onChange={(event) => setProbability(event.target.value)}
          hint="Percent chance of closing. Leave blank if you'd rather not guess."
          error={probabilityInvalid ? "Enter a whole number between 0 and 100." : undefined}
        />

        <Field
          label="Expected close date"
          type="date"
          value={closeDate}
          onChange={(event) => setCloseDate(event.target.value)}
        />

        <SearchableSelect
          label="Contact"
          value={contact}
          onChange={setContact}
          useSearch={useContactOptions}
          hint="Changing the contact clears the linked company."
          required
        />
      </form>
    </Modal>
  );
}
