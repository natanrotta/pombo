import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/core/di/repositories";
import { queryKeys } from "@/core/query/queryKeys";
import { STALE_TIMES } from "@/core/query/staleTimes";

/**
 * How many messages are waiting to be sent for the account (GET
 * /messages/queue) — the backlog counter on the device list.
 *
 * Volatile: the drain empties it continuously, so a short dedup window keeps
 * the number honest without polling.
 */
export function useQueuedMessages() {
  return useQuery({
    queryKey: queryKeys.messaging.queueSummary(),
    queryFn: ({ signal }) => repositories.messaging.getQueueSummary(signal),
    staleTime: STALE_TIMES.volatile,
  });
}
