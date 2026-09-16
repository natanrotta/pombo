import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import type { AuthUser } from "@/modules/auth/domain/entities/AuthUser";

/**
 * Decides where to send the user right after sign-in/sign-up/google succeeds.
 * Centralised so guards and pages stay in sync — change in one place if the
 * post-auth flow ever gains a step.
 */
export function getPostAuthDestination(user: AuthUser | null): string {
  if (!user) return ROUTE_PATHS.signIn;
  // Unverified email+password accounts must confirm the PIN first. A logged-in
  // user normally already has emailVerified=true (the verify step issues the
  // session), so this is a defensive guard for any path that surfaces an
  // unverified user.
  if (!user.emailVerified) return ROUTE_PATHS.verifyEmail;
  return ROUTE_PATHS.devices;
}

/**
 * Where a successful sign-in goes: back to the protected page that bounced the
 * user to /sign-in (`ProtectedRoute` stores it in `location.state.from`), or
 * the standard post-auth destination.
 */
export function resolveSignInRedirect(
  state: unknown,
  user: AuthUser | null,
): string {
  if (state && typeof state === "object" && "from" in state) {
    const from = (state as { from?: { pathname?: string } }).from;
    if (from?.pathname && from.pathname !== ROUTE_PATHS.signIn) {
      return from.pathname;
    }
  }
  return getPostAuthDestination(user);
}
