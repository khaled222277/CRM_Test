import { getErrorMessage } from "@/api/client";
import { useDashboardSummary } from "@/api/hooks";
import type { DashboardSummary } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { IconDashboard } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingRegion } from "@/components/ui/Skeleton";

import { ClosingSoon, ClosingSoonSkeleton } from "./dashboard/ClosingSoon";
import { PipelineChart, PipelineChartSkeleton } from "./dashboard/PipelineChart";
import { RecentActivity, RecentActivitySkeleton } from "./dashboard/RecentActivity";
import { StatCards, StatCardsSkeleton } from "./dashboard/StatCards";

/** True only for an account that has literally nothing in it yet. */
function isBrandNew(summary: DashboardSummary): boolean {
  return (
    summary.totals.contacts === 0 &&
    summary.totals.companies === 0 &&
    summary.totals.open_deals === 0 &&
    summary.recent_activity.length === 0 &&
    summary.deals_closing_soon.length === 0 &&
    summary.tasks.overdue_count === 0 &&
    summary.tasks.due_this_week_count === 0 &&
    summary.pipeline.every((stage) => stage.count === 0)
  );
}

function firstName(fullName: string | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || null;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch, isFetching } = useDashboardSummary();

  const greeting = firstName(user?.full_name);

  if (isPending) {
    return (
      <>
        <PageHeader title="Dashboard" description="Loading your latest numbers..." />
        <LoadingRegion label="Loading dashboard">
          <div className="space-y-6">
            <StatCardsSkeleton />
            <PipelineChartSkeleton />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <RecentActivitySkeleton />
              <ClosingSoonSkeleton />
            </div>
          </div>
        </LoadingRegion>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card className="p-6">
          <Alert tone="danger" title="Couldn't load your dashboard">
            {getErrorMessage(error, "The request failed. Please try again.")}
          </Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => void refetch()} loading={isFetching}>
              Try again
            </Button>
          </div>
        </Card>
      </>
    );
  }

  if (isBrandNew(data)) {
    return (
      <>
        <PageHeader
          title={greeting ? `Welcome, ${greeting}` : "Welcome"}
          description="Your workspace is ready. Here's how to get going."
        />
        <Card className="px-6 py-12">
          <div className="mx-auto max-w-md text-center">
            <span
              className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-50 text-accent-600 ring-1 ring-accent-100"
              aria-hidden="true"
            >
              <IconDashboard className="size-5" />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-ink-900">
              Nothing to show just yet
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              This dashboard fills in as you work. Add a company and a contact, open a deal
              against them, and you'll see your pipeline, recent activity and upcoming
              closes here.
            </p>
            <ul className="mx-auto mt-6 max-w-xs space-y-2.5 text-left">
              {[
                "Add a company and your first contact",
                "Open a deal and set an expected close date",
                "Log a call or note to start the activity trail",
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-2.5 text-[13px] text-ink-600">
                  <span
                    className="mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[10px] font-semibold text-ink-500"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[12px] text-ink-400">
              Contacts and deals arrive in Phase 2.
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          greeting
            ? `Here's where things stand, ${greeting}.`
            : "Here's where things stand."
        }
      />
      <div className="space-y-6">
        <StatCards summary={data} />
        <PipelineChart pipeline={data.pipeline} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RecentActivity activities={data.recent_activity} />
          <ClosingSoon deals={data.deals_closing_soon} />
        </div>
      </div>
    </>
  );
}
