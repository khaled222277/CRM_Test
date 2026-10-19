import { useAuth } from "@/auth/AuthContext";
import { IconLogout, IconMenu } from "@/components/icons";
import { Button } from "@/components/ui/Button";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/85 px-4 backdrop-blur-sm sm:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        className="-ml-1 rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700 lg:hidden"
        aria-label="Open navigation"
      >
        <IconMenu className="size-5" />
      </button>

      <div className="ml-auto flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-7 items-center justify-center rounded-full bg-ink-200 text-[11px] font-semibold text-ink-600"
              aria-hidden="true"
            >
              {initials(user.full_name)}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[13px] font-medium text-ink-800">
                {user.full_name}
              </span>
              <span className="block text-[11px] text-ink-500">{user.email}</span>
            </span>
          </div>
        )}

        <span className="h-5 w-px bg-ink-200" aria-hidden="true" />

        <Button variant="ghost" size="sm" onClick={logout}>
          <IconLogout className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
