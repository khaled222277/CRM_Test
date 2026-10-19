import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { FullPageSpinner } from "@/components/ui/FullPageSpinner";

import { useAuth } from "./AuthContext";

/**
 * Gate for authenticated routes.
 *
 * While the stored token is being validated against GET /auth/me the status is
 * "checking" -- redirecting then would bounce a legitimately signed-in user to
 * the login screen on every refresh, so it holds instead.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return <FullPageSpinner label="Restoring your session" />;
  }

  if (status === "anonymous") {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/** Inverse guard: keeps a signed-in user off the login and register screens. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "checking") {
    return <FullPageSpinner label="Restoring your session" />;
  }

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
