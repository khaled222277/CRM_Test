import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getErrorMessage } from "@/api/client";
import {
  useContact,
  useCreateCompany,
  useCreateContact,
  useUpdateContact,
} from "@/api/hooks";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCompanyOptions } from "@/components/ui/pickerHooks";
import {
  SearchableSelect,
  type SearchableOption,
} from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

/**
 * Create and edit share this page.
 *
 * These are full routes (/contacts/new, /contacts/:id/edit) rather than modals:
 * a contact record is a destination worth linking to and reloading. Transient
 * actions launched from a view you want to stay on -- logging activity, adding
 * a deal from the board, confirming a delete -- are modals instead.
 */
export function ContactFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const contactId = Number(id);
  const navigate = useNavigate();
  const { notify } = useToast();

  const existing = useContact(mode === "edit" ? contactId : Number.NaN);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact(contactId);
  const createCompany = useCreateCompany();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [company, setCompany] = useState<SearchableOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(mode === "create");

  // Fill the form once the record arrives, without clobbering later edits.
  useEffect(() => {
    if (mode !== "edit" || hydrated || !existing.data) return;
    const contact = existing.data;
    setName(contact.name);
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setNotes(contact.notes ?? "");
    setCompany(
      contact.company ? { id: contact.company.id, label: contact.company.name } : null,
    );
    setHydrated(true);
  }, [mode, hydrated, existing.data]);

  const saving = createContact.isPending || updateContact.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const payload = {
      name: name.trim(),
      email: email.trim() === "" ? null : email.trim(),
      phone: phone.trim() === "" ? null : phone.trim(),
      company_id: company?.id ?? null,
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    try {
      if (mode === "create") {
        const created = await createContact.mutateAsync(payload);
        notify("Contact created.");
        navigate(`/contacts/${created.id}`, { replace: true });
      } else {
        await updateContact.mutateAsync(payload);
        notify("Contact updated.");
        navigate(`/contacts/${contactId}`, { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not save this contact."));
    }
  }

  if (mode === "edit" && existing.isPending) {
    return (
      <>
        <PageHeader title="Edit contact" />
        <Card className="max-w-lg p-5">
          <div className="space-y-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
        </Card>
      </>
    );
  }

  if (mode === "edit" && existing.isError) {
    return (
      <>
        <PageHeader title="Edit contact" />
        <Card className="p-6">
          <Alert tone="danger" title="Couldn't load this contact">
            {getErrorMessage(existing.error, "It may have been deleted.")}
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

  const backTo = mode === "edit" ? `/contacts/${contactId}` : "/contacts";

  return (
    <>
      <div className="mb-4">
        <Link
          to={backTo}
          className="text-[13px] text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
        >
          &larr; {mode === "edit" ? "Back to contact" : "Contacts"}
        </Link>
      </div>

      <PageHeader
        title={mode === "create" ? "New contact" : "Edit contact"}
        description={
          mode === "create"
            ? "Only a name is required. Everything else can come later."
            : undefined
        }
      />

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && <Alert tone="danger">{error}</Alert>}

          <Field
            label="Name"
            placeholder="Dana Ito"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
          />

          <Field
            label="Email"
            type="email"
            placeholder="dana@northwind.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Field
            label="Phone"
            type="tel"
            placeholder="+1 555 0100"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          <SearchableSelect
            label="Company"
            placeholder="Search companies..."
            value={company}
            onChange={setCompany}
            useSearch={useCompanyOptions}
            onCreate={async (companyName) => {
              const created = await createCompany.mutateAsync(companyName);
              return { id: created.id, label: created.name };
            }}
            createLabel="Create company"
            emptyMessage="No companies yet -- type a name to create one."
            hint="Optional. Type a new name and pick 'Create company' if it isn't listed."
          />

          <Textarea
            label="Notes"
            rows={3}
            placeholder="Anything worth remembering..."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button variant="secondary" type="button" onClick={() => navigate(backTo)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={saving}
              disabled={!name.trim()}
            >
              {mode === "create" ? "Create contact" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
