import { useDroppable } from "@dnd-kit/core";

import type { DealOut, DealStage } from "@/api/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatMoney, stageLabel } from "@/lib/format";
import { stageBarClass } from "@/lib/stages";

import { DealCard } from "./DealCard";

export function KanbanColumn({
  stage,
  deals,
  isDragActive,
}: {
  stage: DealStage;
  deals: DealOut[];
  isDragActive: boolean;
}) {
  // Won and lost still accept drops -- the backend only blocks *leaving* a
  // terminal stage, not entering one.
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  // Header totals are computed from the deals already loaded, so the board
  // never makes a second call to /deals/pipeline-summary for the same numbers.
  const total = deals.reduce((sum, deal) => sum + (Number.parseFloat(deal.value) || 0), 0);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border transition-colors duration-150",
        isOver
          ? "border-accent-300 bg-accent-50/50"
          : isDragActive
            ? "border-ink-200 bg-ink-50"
            : "border-ink-200 bg-ink-50/60",
      )}
      aria-label={`${stageLabel(stage)}, ${deals.length} deals`}
    >
      <header className="border-b border-ink-200/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", stageBarClass(stage))}
            aria-hidden="true"
          />
          <h2 className="flex-1 text-[13px] font-semibold tracking-tight text-ink-700">
            {stageLabel(stage)}
          </h2>
          <span className="tabular rounded bg-ink-200/70 px-1.5 py-0.5 text-[11px] font-medium text-ink-600">
            {deals.length}
          </span>
        </div>
        <p className="tabular mt-1 pl-3.5 text-[12px] text-ink-500">{formatMoney(total)}</p>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {deals.length === 0 ? (
          <p
            className={cn(
              "rounded-md border border-dashed px-3 py-6 text-center text-[12px]",
              isOver ? "border-accent-300 text-accent-700" : "border-ink-200 text-ink-400",
            )}
          >
            {isDragActive ? "Drop here" : "No deals"}
          </p>
        ) : (
          deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
      </div>
    </section>
  );
}

export function KanbanColumnSkeleton({ cards }: { cards: number }) {
  return (
    <section className="flex w-72 shrink-0 flex-col rounded-lg border border-ink-200 bg-ink-50/60">
      <header className="border-b border-ink-200/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-1.5 rounded-full" />
          <Skeleton className="h-3 w-24 flex-1" />
          <Skeleton className="h-4 w-6 rounded" />
        </div>
        <Skeleton className="mt-1.5 ml-3.5 h-2.5 w-16" />
      </header>
      <div className="space-y-2 p-2">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="rounded-lg border border-ink-200 bg-white px-3 py-2.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2 h-3.5 w-20" />
            <div className="mt-2.5 flex items-center justify-between">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
