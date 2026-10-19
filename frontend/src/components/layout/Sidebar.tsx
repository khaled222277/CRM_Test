import { NavLink } from "react-router-dom";

import {
  IconContacts,
  IconDashboard,
  IconPipeline,
  IconTasks,
} from "@/components/icons";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { to: "/pipeline", label: "Pipeline", icon: IconPipeline },
  { to: "/contacts", label: "Contacts", icon: IconContacts },
  { to: "/tasks", label: "Tasks", icon: IconTasks },
] as const;

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <Wordmark />
      </div>

      <nav className="flex-1 px-3 py-2" aria-label="Main">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2",
                    "text-[13px] font-medium transition-colors duration-150",
                    isActive
                      ? "bg-accent-50 text-accent-700"
                      : "text-ink-600 hover:bg-ink-100 hover:text-ink-800",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active marker: a rail rather than a filled block, so the
                        accent stays quiet even when a nav item is selected. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0 h-4 w-0.5 rounded-r-full bg-accent-600",
                        "transition-opacity duration-150",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon
                      className={cn(
                        "size-[18px] shrink-0",
                        isActive ? "text-accent-600" : "text-ink-400 group-hover:text-ink-500",
                      )}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-ink-200 px-5 py-3">
        <p className="text-[11px] text-ink-400">Phase 1 &middot; Dashboard</p>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex size-6 items-center justify-center rounded bg-accent-600 text-[11px] font-bold text-white"
        aria-hidden="true"
      >
        C
      </span>
      <span className="text-sm font-semibold tracking-tight text-ink-800">Cadence</span>
    </span>
  );
}

/** Fixed rail on large viewports. The drawer variant lives in AppShell. */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-ink-200 bg-white lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent />
      </div>
    </aside>
  );
}
