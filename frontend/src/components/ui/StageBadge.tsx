import type { DealStage } from "@/api/types";
import { stageLabel } from "@/lib/format";
import { stageTone } from "@/lib/stages";

import { Badge } from "./Badge";

/** Consistent stage rendering. Colours come from lib/stages, same as the chart. */
export function StageBadge({ stage, className }: { stage: DealStage; className?: string }) {
  return (
    <Badge tone={stageTone(stage)} className={className}>
      {stageLabel(stage)}
    </Badge>
  );
}
