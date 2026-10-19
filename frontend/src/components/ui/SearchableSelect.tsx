import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export interface SearchableOption {
  id: number;
  label: string;
  sublabel?: string | null;
}

interface ComboBoxProps {
  label: string;
  placeholder?: string;
  value: SearchableOption | null;
  onChange: (option: SearchableOption | null) => void;
  options: SearchableOption[];
  isFetching?: boolean;
  /** Notified as the user types, so a server-backed caller can requery. */
  onTermChange?: (term: string) => void;
  /**
   * Filter `options` against the typed term in the browser. For server-backed
   * callers this stays off -- the query already returned matches, and
   * filtering again would hide rows the API matched on a field we don't show
   * (an email, say).
   */
  filterLocally?: boolean;
  onCreate?: (name: string) => Promise<SearchableOption>;
  createLabel?: string;
  emptyMessage?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

/**
 * The combobox UI, with no opinion about where options come from.
 *
 * Split out from SearchableSelect so a caller with an in-memory list (the task
 * form's deal picker, which only ever shows one contact's deals) can reuse the
 * exact same control without a server round trip -- and without SearchableSelect
 * having to call a hook conditionally.
 */
export function ComboBox({
  label,
  placeholder = "Search...",
  value,
  onChange,
  options: allOptions,
  isFetching = false,
  onTermChange,
  filterLocally = false,
  onCreate,
  createLabel = "Create",
  emptyMessage = "No matches",
  required,
  error,
  hint,
  disabled,
  disabledMessage,
}: ComboBoxProps) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = term.trim();
  const options =
    filterLocally && trimmed
      ? allOptions.filter((option) =>
          option.label.toLowerCase().includes(trimmed.toLowerCase()),
        )
      : allOptions;
  const exactMatch = options.some(
    (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = Boolean(onCreate) && trimmed.length > 0 && !exactMatch && !isFetching;
  const rowCount = options.length + (showCreate ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => setActiveIndex(0), [term, open]);

  function setSearchTerm(next: string) {
    setTerm(next);
    onTermChange?.(next);
  }

  async function choose(index: number) {
    if (showCreate && index === options.length) {
      if (!onCreate) return;
      setCreating(true);
      try {
        onChange(await onCreate(trimmed));
        setOpen(false);
        setSearchTerm("");
      } finally {
        setCreating(false);
      }
      return;
    }

    const option = options[index];
    if (!option) return;
    onChange(option);
    setOpen(false);
    setSearchTerm("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + delta + rowCount) % Math.max(rowCount, 1));
    } else if (event.key === "Enter") {
      if (open && rowCount > 0) {
        event.preventDefault();
        void choose(activeIndex);
      }
    } else if (event.key === "Escape") {
      // Swallow it so an open dropdown inside a dialog closes the list, not
      // the whole dialog.
      if (open) {
        event.stopPropagation();
        setOpen(false);
      }
    }
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label htmlFor={inputId} className="block text-[13px] font-medium text-ink-700">
        {label}
      </label>

      {value ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border border-ink-300 bg-white px-3 py-2",
            disabled && "bg-ink-50",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-ink-800">{value.label}</span>
            {value.sublabel && (
              <span className="block truncate text-[12px] text-ink-500">{value.sublabel}</span>
            )}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(true);
              }}
              className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            disabled={disabled}
            placeholder={disabled ? (disabledMessage ?? placeholder) : placeholder}
            value={term}
            required={required}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(
              "block w-full rounded-md border bg-white px-3 py-2 text-sm text-ink-800",
              "placeholder:text-ink-400 transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-accent-500/30",
              error ? "border-danger-600" : "border-ink-300 focus:border-accent-500",
              "disabled:bg-ink-50 disabled:text-ink-400",
            )}
          />

          {open && !disabled && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-ink-200 bg-white py-1 shadow-lg"
            >
              {options.map((option, index) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => void choose(index)}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left",
                      index === activeIndex ? "bg-accent-50" : "hover:bg-ink-50",
                    )}
                  >
                    <span className="block truncate text-[13px] text-ink-800">
                      {option.label}
                    </span>
                    {option.sublabel && (
                      <span className="block truncate text-[12px] text-ink-500">
                        {option.sublabel}
                      </span>
                    )}
                  </button>
                </li>
              ))}

              {showCreate && (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeIndex === options.length}
                    onMouseEnter={() => setActiveIndex(options.length)}
                    onClick={() => void choose(options.length)}
                    disabled={creating}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-[13px] font-medium text-accent-700",
                      activeIndex === options.length ? "bg-accent-50" : "hover:bg-ink-50",
                    )}
                  >
                    {creating ? "Creating..." : `${createLabel} "${trimmed}"`}
                  </button>
                </li>
              )}

              {options.length === 0 && !showCreate && (
                <li className="px-3 py-2 text-[13px] text-ink-500">
                  {isFetching ? "Searching..." : emptyMessage}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {error ? (
        <p className="text-[13px] text-danger-600">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Server-backed combobox.
 *
 * The caller supplies a `useSearch` hook keyed on the debounced term, so typing
 * "northwind" fires one request rather than nine.
 *
 * `onCreate`, when given, adds an explicit "Create <term>" row. That is a
 * deliberate choice over silently creating records from free text: it takes a
 * click, so a typo becomes a search miss rather than a duplicate.
 */
export function SearchableSelect({
  useSearch,
  ...props
}: Omit<ComboBoxProps, "options" | "isFetching" | "onTermChange"> & {
  useSearch: (
    term: string,
    enabled: boolean,
  ) => { data: SearchableOption[] | undefined; isFetching: boolean };
}) {
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebouncedValue(term, 300);
  const { data, isFetching } = useSearch(debouncedTerm, !props.disabled);

  return (
    <ComboBox
      {...props}
      options={data ?? []}
      isFetching={isFetching}
      onTermChange={setTerm}
    />
  );
}
