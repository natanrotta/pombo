import { Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { lazyWithRetry } from "@/app/router/lazyWithRetry";
import { ProtectedRoute } from "@/app/router/guards/ProtectedRoute";
import { PublicOnlyRoute } from "@/app/router/guards/PublicOnlyRoute";
import { NotFoundPage } from "@/app/router/NotFoundPage";
import { RouteErrorBoundary } from "@/shared/components/ui/RouteErrorBoundary";
import { PageTransition } from "@/shared/components/animations/PageTransition";
import { AppShell } from "@/shared/components/layout/AppShell";
import { RouteContentSkeleton } from "@/shared/components/skeletons/RouteContentSkeleton";

// Lazy-loaded pages — each becomes a separate chunk
const RegisterPage = lazyWithRetry(() =>
  import("@/modules/auth/presentation/pages/RegisterPage").then((m) => ({
    default: m.RegisterPage,
  }))
);
const SignInPage = lazyWithRetry(() =>
  import("@/modules/auth/presentation/pages/SignInPage").then((m) => ({ default: m.SignInPage }))
);
const EmailVerificationPage = lazyWithRetry(() =>
  import("@/modules/auth/presentation/pages/EmailVerificationPage").then((m) => ({
    default: m.EmailVerificationPage,
  }))
);
const ForgotPasswordPage = lazyWithRetry(() =>
  import("@/modules/auth/presentation/pages/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  }))
);
const ResetPasswordPage = lazyWithRetry(() =>
  import("@/modules/auth/presentation/pages/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage,
  }))
);
const ProfilePage = lazyWithRetry(() =>
  import("@/modules/settings/presentation/pages/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  }))
);
const ApiPage = lazyWithRetry(() =>
  import("@/modules/account/presentation/pages/ApiPage").then((m) => ({
    default: m.ApiPage,
  }))
);
const DevicesListPage = lazyWithRetry(() =>
  import("@/modules/devices/presentation/pages/DevicesListPage").then((m) => ({
    default: m.DevicesListPage,
  }))
);
const DeviceDetailPage = lazyWithRetry(() =>
  import("@/modules/devices/presentation/pages/DeviceDetailPage").then((m) => ({
    default: m.DeviceDetailPage,
  }))
);
const SandboxPage = lazyWithRetry(() =>
  import("@/modules/messaging/presentation/pages/SandboxPage").then((m) => ({
    default: m.SandboxPage,
  }))
);

// Dev-only styleguide: excluded from production builds, so the chunk never
// ships and the route never mounts outside local development (and e2e, which
// runs against the Vite dev server).
const StyleguidePage = import.meta.env.DEV
  ? lazyWithRetry(() =>
      import("@/modules/development/presentation/pages/StyleguidePage").then((m) => ({
        default: m.StyleguidePage,
      }))
    )
  : null;

// Single layout route for all protected pages. AppShell + sidebar stay mounted
// across navigations — only the content inside PageTransition swaps, with a
// cross-fade (old exits → new enters) via AnimatePresence.
function ProtectedLayout() {
  const location = useLocation();
  return (
    <ProtectedRoute>
      <AppShell>
        <RouteErrorBoundary locationKey={location.key}>
          {/* Only while the lazy chunk downloads: each page owns its loading
              state once it mounts. The skeleton reveals itself after a short
              delay, so fast chunk loads never flash it. */}
          <Suspense fallback={<RouteContentSkeleton />}>
            <PageTransition />
          </Suspense>
        </RouteErrorBoundary>
      </AppShell>
    </ProtectedRoute>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path={ROUTE_PATHS.signIn}
        element={
          <PublicOnlyRoute>
            <Suspense fallback={null}>
              <SignInPage />
            </Suspense>
          </PublicOnlyRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.register}
        element={
          <PublicOnlyRoute>
            <Suspense fallback={null}>
              <RegisterPage />
            </Suspense>
          </PublicOnlyRoute>
        }
      />
      {/* E-mail confirmation step (between sign-up and the app). Standalone:
          the user holds a scoped verify-email token, not a full session, so
          neither PublicOnlyRoute nor ProtectedRoute applies. */}
      <Route
        path={ROUTE_PATHS.verifyEmail}
        element={
          <Suspense fallback={null}>
            <EmailVerificationPage />
          </Suspense>
        }
      />
      <Route
        path={ROUTE_PATHS.forgotPassword}
        element={
          <PublicOnlyRoute>
            <Suspense fallback={null}>
              <ForgotPasswordPage />
            </Suspense>
          </PublicOnlyRoute>
        }
      />
      <Route
        path={ROUTE_PATHS.resetPassword}
        element={
          <Suspense fallback={null}>
            <ResetPasswordPage />
          </Suspense>
        }
      />

      {/* Protected routes share a single AppShell via the layout route below.
          This avoids remounting the shell / sidebar on every navigation. */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to={ROUTE_PATHS.devices} replace />} />

        <Route path={ROUTE_PATHS.devices} element={<DevicesListPage />} />
        <Route
          path={ROUTE_PATHS.deviceDetail}
          element={<DeviceDetailPage />}
        />

        <Route path={ROUTE_PATHS.sandbox} element={<SandboxPage />} />

        <Route path={ROUTE_PATHS.profile} element={<ProfilePage />} />
        <Route path={ROUTE_PATHS.api} element={<ApiPage />} />
        {/* `/settings` is kept as a redirect to Perfil for old deep links. */}
        <Route
          path={ROUTE_PATHS.settings}
          element={<Navigate to={ROUTE_PATHS.profile} replace />}
        />

        {StyleguidePage ? (
          <Route path={ROUTE_PATHS.styleguide} element={<StyleguidePage />} />
        ) : null}

        <Route path={ROUTE_PATHS.notFound} element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
