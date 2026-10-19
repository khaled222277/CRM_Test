import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";

import type { DealOut } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { dueUrgency, daysUntilDate, formatDaysUntil, formatMoney } from "@/lib/format";
import { isTerminalStage } from "@/lib/stages";

/** The visual body of a card, shared by the board and the drag overlay. */
export function DealCardBody({
  deal,
  dragging = false,
  closed = false,
}: {
  deal: DealOut;
  dragging?: boolean;
  closed?: boolean;
}) {
  const days = deal.expected_close_date ? daysUntilDate(deal.expected_close_date) : null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white px-3 py-2.5 text-left",
        "shadow-[0_1px_2px_rgba(22,25,29,0.04)]",
        dragging ? "border-accent-300 shadow-lg" : "border-ink-200",
        // Closed deals read as settled rather than active. Combined with the
        // "Closed" chip this makes the missing drag affordance intentional.
        closed && "bg-ink-50/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-medium",
            closed ? "text-ink-600" : "text-ink-800",
          )}
        >
          {deal.title}
        </p>
        {closed && (
          <span className="shrink-0 rounded bg-ink-200/70 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
            Closed
          </span>
        )}
      </div>

      <p className="tabular mt-1.5 text-[13px] font-semibold text-ink-800">
        {formatMoney(deal.value)}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] text-ink-500">{deal.contact.name}</span>
        {days !== null && (
          <Badge tone={closed ? "neutral" : dueUrgency(days)} className="shrink-0">
            {formatDaysUntil(days)}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function DealCard({ deal }: { deal: DealOut }) {
  const navigate = useNavigate();
  const closed = isTerminalStage(deal.stage);

  // Won and lost deals cannot leave their stage -- the backend returns a 400.
  // Disabling the draggable here means the card never lifts, so the rule is
  // obvious before the user commits to a drag rather than after it snaps back.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: closed,
    data: { stage: deal.stage },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <button
        type="button"
        onClick={() => navigate(`/deals/${deal.id}`)}
        className={cn(
          "block w-full rounded-lg text-left transition-shadow",
          closed ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        )}
        aria-label={`${deal.title}, ${formatMoney(deal.value)}, ${deal.contact.name}`}
        {...listeners}
        {...attributes}
      >
        <DealCardBody deal={deal} closed={closed} />
      </button>
    </div>
  );
}
