import { Suspense, type PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/modules/auth/presentation/context/AuthContext";
import { queryClient } from "@/core/query/queryClient";
import { COLOR_MODE_STORAGE_KEY } from "@/app/theme";
import { Provider as ChakraUIProvider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { lazyWithRetry } from "@/app/router/lazyWithRetry";

// `lazyWithRetry` (not raw `lazy`): this renders above the router, so a stale
// devtools chunk would otherwise crash straight to GlobalErrorBoundary.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazyWithRetry(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : () => null;

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    // Chakra UI v3 provider (system + color mode). Color mode is driven by
    // `next-themes` (class strategy); `defaultTheme="system"` respects the OS on
    // the first visit, then the explicit choice persists under `storageKey` —
    // the same key the v2 color-mode boot script used, so returning users keep theirs.
    <ChakraUIProvider defaultTheme="system" storageKey={COLOR_MODE_STORAGE_KEY}>
      <Toaster />
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthProvider>{children}</AuthProvider>
        </GoogleOAuthProvider>
        <Suspense>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-right"
          />
        </Suspense>
      </QueryClientProvider>
    </ChakraUIProvider>
  );
}
