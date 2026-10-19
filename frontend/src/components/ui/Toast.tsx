import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

import { IconClose } from "../icons";

/*
 * Minimal toast system -- no dependency for something this small.
 *
 * Used for outcomes the user needs to know about but should not have to
 * acknowledge: a drag that got rolled back, a deal that saved. Anything the
 * user must act on belongs in an Alert inside the view instead.
 */

type ToastTone = "success" | "error";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_AFTER_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-md border px-3.5 py-2.5",
              "text-[13px] shadow-lg",
              toast.tone === "error"
                ? "border-danger-100 bg-danger-50 text-danger-700"
                : "border-ink-200 bg-white text-ink-700",
            )}
          >
            <span className="flex-1 leading-relaxed">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="-mr-0.5 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
            >
              <IconClose className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
