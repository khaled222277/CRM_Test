import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";

import { IconClose } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Dialog primitive, built on Radix.
 *
 * Radix owns the behaviour that is genuinely hard to hand-roll: a real focus
 * trap (Tab and Shift+Tab cycle within the panel, with sentinel focus guards
 * either side of the portal), focus restore to the trigger on close, Escape,
 * click-outside, scroll lock, `aria-labelledby`/`aria-describedby` wired to the
 * Title and Description below, and `hideOthers()` to drop the rest of the page
 * out of the accessibility tree. The previous version of this file did the
 * first four by hand and got the focus trap wrong -- Tab could walk into the
 * page behind the panel.
 *
 * Everything below the behaviour layer is unchanged styling, so this looks
 * identical to what it replaced.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/35" />
        <Dialog.Content
          ref={contentRef}
          // Radix focuses the first tabbable node, which here is the close
          // button. Prefer the first field so a form dialog opens ready to
          // type -- matching how this behaved before the Radix swap. The focus
          // *trap* is untouched; this only picks the starting point.
          onOpenAutoFocus={(event) => {
            const field = contentRef.current?.querySelector<HTMLElement>(
              "input:not([type='hidden']), textarea, select",
            );
            if (field) {
              event.preventDefault();
              field.focus();
            }
          }}
          className={cn(
            "fixed z-50 flex max-h-[90vh] w-full flex-col overflow-hidden",
            "border border-ink-200 bg-white shadow-xl",
            // Bottom sheet on narrow screens, centred panel from sm up.
            "bottom-0 left-1/2 -translate-x-1/2 rounded-t-xl",
            "sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-xl",
            size === "sm" && "sm:max-w-sm",
            size === "md" && "sm:max-w-md",
            size === "lg" && "sm:max-w-lg",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
            <div>
              <Dialog.Title className="text-sm font-semibold tracking-tight text-ink-900">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-ink-500">
                  {description}
                </Dialog.Description>
              ) : (
                // Radix warns when Content has no description; this says
                // "intentionally none" rather than pointing at a missing id.
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mr-1 rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <IconClose className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer && (
            <div className="flex justify-end gap-2 border-t border-ink-200 bg-ink-50/60 px-5 py-3.5">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
