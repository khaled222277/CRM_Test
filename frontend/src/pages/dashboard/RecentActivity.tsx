import { ActivityList, ActivityListSkeleton } from "@/components/activities/ActivityList";
import type { ActivityOut } from "@/api/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function RecentActivity({ activities }: { activities: ActivityOut[] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title="Recent activity" description="Calls, emails and notes you've logged" />
      <ActivityList
        activities={activities}
        emptyDescription="Calls, meetings and notes you record against a contact will show up here."
      />
    </Card>
  );
}

export function RecentActivitySkeleton() {
  return (
    <Card>
      <div className="border-b border-ink-200 px-5 py-4">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="mt-2 h-3 w-52" />
      </div>
      <ActivityListSkeleton rows={5} />
    </Card>
  );
}
