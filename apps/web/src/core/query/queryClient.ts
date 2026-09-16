import { QueryClient } from "@tanstack/react-query";
import { AppError } from "@/core/errors/AppError";
import { STALE_TIMES } from "@/core/query/staleTimes";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep results fresh for a minute so returning to a page within the
      // same session is instant instead of re-triggering a loading state.
      staleTime: STALE_TIMES.default,
      // gcTime must be ≥ 3× the longest staleTime tier so reference data
      // (5 min) survives navigation away-and-back; otherwise the cache is
      // garbage-collected at the exact moment it becomes stale.
      gcTime: 15 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof AppError) {
          if (error.statusCode === 429) return false;
          if (error.statusCode >= 400 && error.statusCode < 500) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
