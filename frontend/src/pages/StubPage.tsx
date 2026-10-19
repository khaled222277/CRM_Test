import type { ComponentType, SVGProps } from "react";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * Placeholder for routes that are wired into the nav but not yet built.
 *
 * Says what is coming rather than showing a blank page, so clicking a nav item
 * never feels broken.
 */
export function StubPage({
  title,
  description,
  icon: Icon,
  bullets,
}: {
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  bullets: string[];
}) {
  return (
    <>
      <PageHeader title={title} />
      <Card className="px-6 py-12">
        <div className="mx-auto max-w-md text-center">
          <span
            className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-400 ring-1 ring-ink-200/70"
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </span>
          <p className="text-sm font-medium text-ink-700">Coming in Phase 2</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{description}</p>
          <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-[13px] text-ink-600">
                <span
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-300"
                  aria-hidden="true"
                />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}
