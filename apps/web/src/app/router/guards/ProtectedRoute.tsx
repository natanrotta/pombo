import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/modules/auth";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { AppShellSkeleton } from "@/shared/components/skeletons/AppShellSkeleton";

/**
 * Gate for every authenticated route. Unauthenticated users are sent to
 * /sign-in, preserving the intended destination in navigation state.
 */
export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AppShellSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={ROUTE_PATHS.signIn} replace state={{ from: location }} />
    );
  }

  return <>{children}</>;
}
