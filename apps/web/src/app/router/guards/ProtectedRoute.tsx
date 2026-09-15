import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Center, Spinner } from "@chakra-ui/react";
import { useAuth } from "@/modules/auth";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";

/**
 * Gate for every authenticated route. Unauthenticated users are sent to
 * /sign-in, preserving the intended destination in navigation state.
 */
export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Center minH="100vh">
        <Spinner
          color="brand.500"
          borderWidth="3px"
          animationDuration="0.65s"
          size="xl"
        />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to={ROUTE_PATHS.signIn} replace state={{ from: location }} />
    );
  }

  return <>{children}</>;
}
