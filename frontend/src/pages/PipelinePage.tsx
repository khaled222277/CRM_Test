import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { getErrorMessage } from "@/api/client";
import { useBoardDeals, useChangeDealStage } from "@/api/hooks";
import { STAGE_ORDER, type DealOut, type DealStage } from "@/api/types";
import { IconPipeline } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingRegion } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { isTerminalStage } from "@/lib/stages";

import { DealCardBody } from "./pipeline/DealCard";
import { KanbanColumn, KanbanColumnSkeleton } from "./pipeline/KanbanColumn";
import { NewDealDialog } from "./pipeline/NewDealDialog";

export function PipelinePage() {
  const { data: deals, isPending, isError, error, refetch, isFetching } = useBoardDeals();
  const changeStage = useChangeDealStage();
  const { notify } = useToast();

  const [activeDeal, setActiveDeal] = useState<DealOut | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);

  // A small activation distance means a click still reads as a click; without
  // it every card tap would start a drag and navigation would never fire.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const byStage = useMemo(() => {
    const groups = new Map<DealStage, DealOut[]>(STAGE_ORDER.map((stage) => [stage, []]));
    for (const deal of deals ?? []) {
      groups.get(deal.stage)?.push(deal);
    }
    return groups;
  }, [deals]);

  function handleDragStart(event: DragStartEvent) {
    const deal = deals?.find((candidate) => candidate.id === event.active.id);
    setActiveDeal(deal ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const deal = activeDeal;
    setActiveDeal(null);

    const targetStage = event.over?.id as DealStage | undefined;
    if (!deal || !targetStage || targetStage === deal.stage) return;

    // Belt and braces: the card is already non-draggable when closed, but a
    // keyboard or programmatic drag should not slip past that rule either.
    if (isTerminalStage(deal.stage)) return;

    changeStage.mutate(
      { dealId: deal.id, stage: targetStage },
      {
        onError: (mutationError) => {
          notify(
            getErrorMessage(mutationError, `Could not move "${deal.title}".`),
            "error",
          );
        },
      },
    );
  }

  const totalDeals = deals?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Drag a deal to move it between stages."
        action={
          <Button variant="primary" onClick={() => setNewDealOpen(true)}>
            New deal
          </Button>
        }
      />

      {isPending && (
        <LoadingRegion label="Loading pipeline">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[3, 2, 2, 1, 1, 1].map((cards, index) => (
              <KanbanColumnSkeleton key={index} cards={cards} />
            ))}
          </div>
        </LoadingRegion>
      )}

      {isError && (
        <Card className="p-6">
          <Alert tone="danger" title="Couldn't load your pipeline">
            {getErrorMessage(error, "The request failed. Please try again.")}
          </Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => void refetch()} loading={isFetching}>
              Try again
            </Button>
          </div>
        </Card>
      )}

      {!isPending && !isError && totalDeals === 0 && (
        <Card>
          <EmptyState
            icon={<IconPipeline className="size-5" />}
            title="No deals in your pipeline"
            description="Create your first deal and it'll appear in the Lead column, ready to drag along as it progresses."
            action={
              <Button variant="primary" onClick={() => setNewDealOpen(true)}>
                New deal
              </Button>
            }
          />
        </Card>
      )}

      {!isPending && !isError && totalDeals > 0 && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDeal(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {STAGE_ORDER.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={byStage.get(stage) ?? []}
                isDragActive={activeDeal !== null}
              />
            ))}
          </div>

          {/* The overlay follows the cursor; the original stays put at 40%
              opacity so the source column keeps its shape while dragging. */}
          <DragOverlay dropAnimation={null}>
            {activeDeal && (
              <div className="w-72 rotate-1">
                <DealCardBody deal={activeDeal} dragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <NewDealDialog open={newDealOpen} onClose={() => setNewDealOpen(false)} />
    </>
  );
}
