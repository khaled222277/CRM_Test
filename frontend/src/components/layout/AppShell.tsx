import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { IconClose } from "@/components/icons";

import { Sidebar, SidebarContent } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the drawer on navigation, otherwise it stays over the new page.
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-screen bg-ink-100">
      <Sidebar />

      {/*
        The mobile drawer is a real modal dialog, so it uses the same Radix
        primitive as the rest of the app rather than a hand-rolled version.
        It previously declared aria-modal="true" while having no focus trap --
        announcing a guarantee it did not keep. Radix now provides the trap,
        focus restore, Escape, scroll lock and aria-hidden on the page behind.
      */}
      <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="drawer-overlay fixed inset-0 z-30 bg-ink-900/35 lg:hidden" />
          <Dialog.Content className="drawer-panel fixed inset-y-0 left-0 z-40 w-64 border-r border-ink-200 bg-white shadow-lg lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">
              Links to the main sections of the app
            </Dialog.Description>
            <Dialog.Close
              aria-label="Close navigation"
              className="absolute top-3.5 right-3 rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <IconClose className="size-4.5" />
            </Dialog.Close>
            <SidebarContent onNavigate={() => setNavOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
