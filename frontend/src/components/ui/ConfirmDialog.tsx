import type { ReactNode } from "react";

import { Alert } from "./Alert";
import { Button } from "./Button";
import { Modal } from "./Modal";

/**
 * Destructive-action confirmation.
 *
 * Takes an `error` so a rejected delete can be shown *inside* the dialog the
 * user is already looking at, rather than dismissing and surfacing the failure
 * somewhere else. That matters for contacts, where the backend refuses the
 * delete with a message worth reading.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-[13px] leading-relaxed text-ink-600">{message}</div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
