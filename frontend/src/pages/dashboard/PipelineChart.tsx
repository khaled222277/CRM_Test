import type { PipelineStageSummary } from "@/api/types";
import { IconPipeline } from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatMoney, stageLabel } from "@/lib/format";
import { stageBarClass } from "@/lib/stages";

/*
 * Div-based bars rather than a charting library.
 *
 * Six horizontal bars do not justify ~50kB of runtime, and plain elements give
 * accessible text and native wrapping for free. Bar colours come from
 * lib/stages so this chart and every StageBadge stay in step.
 */

export function PipelineChart({ pipeline }: { pipeline: PipelineStageSummary[] }) {
  const values = pipeline.map((stage) => Number.parseFloat(stage.total_value) || 0);
  const counts = pipeline.map((stage) => stage.count);

  const totalCount = counts.reduce((sum, count) => sum + count, 0);
  const maxValue = Math.max(...values);
  const maxCount = Math.max(...counts);

  // Deals can legitimately carry a value of 0, which would render every bar
  // invisible. Fall back to scaling by count so the chart still says something.
  const scaleByValue = maxValue > 0;
  const denominator = scaleByValue ? maxValue : maxCount;

  return (
    <Card>
      <CardHeader
        title="Pipeline by stage"
        description={scaleByValue ? "Bar length reflects total value" : "Bar length reflects deal count"}
      />
      {totalCount === 0 ? (
        <EmptyState
          compact
          icon={<IconPipeline className="size-4.5" />}
          title="No deals yet"
          description="Once you add deals they'll break down by stage here, so you can see where everything sits."
        />
      ) : (
        <div className="px-5 py-4">
          <ul className="space-y-3">
            {pipeline.map((stage, index) => {
              const magnitude = scaleByValue ? values[index] : counts[index];
              const percent = denominator > 0 ? (magnitude / denominator) * 100 : 0;

              return (
                <li key={stage.stage}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium text-ink-700">{stageLabel(stage.stage)}</span>
                    <span className="tabular text-ink-500">
                      <span className="text-ink-700">{stage.count}</span>
                      <span className="mx-1.5 text-ink-300">&middot;</span>
                      {formatMoney(stage.total_value)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500 ease-out",
                        stageBarClass(stage.stage),
                      )}
                      // A stage with deals should never render as a bare sliver.
                      style={{ width: stage.count > 0 ? `${Math.max(percent, 2)}%` : "0%" }}
                      role="img"
                      aria-label={`${stageLabel(stage.stage)}: ${stage.count} deals, ${formatMoney(stage.total_value)}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function PipelineChartSkeleton() {
  return (
    <Card>
      <div className="border-b border-ink-200 px-5 py-4">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="mt-2 h-3 w-48" />
      </div>
      <div className="space-y-3 px-5 py-4">
        {[72, 54, 88, 40, 62, 30].map((width, index) => (
          <div key={index}>
            <div className="mb-1.5 flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <Skeleton className="h-full rounded-full" style={{ width: `${width}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
