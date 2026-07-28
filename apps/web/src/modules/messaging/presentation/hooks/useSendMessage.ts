import { useMutation, useQuery } from "@tanstack/react-query";
import { repositories } from "@/core/di/repositories";
import { queryKeys } from "@/core/query/queryKeys";
import { useErrorHandler } from "@/core/query/useErrorHandler";
import type {
  SendTextInput,
  SendImageInput,
  SendAudioInput,
  SendVideoInput,
  SendDocumentInput,
  SendGroupInput,
  MessageStatus,
} from "@/modules/messaging/domain/entities/Message";

/** Discriminated by `type` so `input` narrows to the matching payload. */
export type SendMessageArgs =
  | { deviceId: string; type: "text"; input: SendTextInput }
  | { deviceId: string; type: "image"; input: SendImageInput }
  | { deviceId: string; type: "audio"; input: SendAudioInput }
  | { deviceId: string; type: "video"; input: SendVideoInput }
  | { deviceId: string; type: "document"; input: SendDocumentInput }
  | { deviceId: string; type: "group"; input: SendGroupInput };

/**
 * Fire-and-report send used by the Sandbox. Dispatches to the matching
 * repository method by `type`. There is nothing to invalidate — the sandbox
 * holds the result only in memory. Errors surface via the shared error toast.
 */
export function useSendMessage() {
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationFn: (args: SendMessageArgs) => {
      const repo = repositories.messaging;
      switch (args.type) {
        case "text":
          return repo.sendText(args.deviceId, args.input);
        case "image":
          return repo.sendImage(args.deviceId, args.input);
        case "audio":
          return repo.sendAudio(args.deviceId, args.input);
        case "video":
          return repo.sendVideo(args.deviceId, args.input);
        case "document":
          return repo.sendDocument(args.deviceId, args.input);
        case "group":
          return repo.sendGroupText(args.deviceId, args.input);
      }
    },
    onError: (error) => handleError(error),
  });
}

const MESSAGE_STATUS_POLL_MS = 2_000;
const TERMINAL_STATUSES: ReadonlySet<MessageStatus> = new Set<MessageStatus>([
  "READ",
  "FAILED",
]);

/**
 * Polls `GET /messages/:id` so the Sandbox reflects the live delivery status
 * (PENDING → SERVER_ACK → DELIVERY_ACK → READ / FAILED). Polling stops once a
 * terminal status (READ or FAILED) is reached. `gcTime: 0` drops the snapshot
 * as soon as the result panel unmounts, so a new send starts clean.
 */
export function useMessageStatus(messageId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.messaging.messageStatus(messageId ?? ""),
    queryFn: () => repositories.messaging.getStatus(messageId as string),
    enabled: enabled && Boolean(messageId),
    refetchInterval: (query) => {
      // Stop on a hard error (retries already exhausted) — otherwise a
      // permanent 4xx/5xx would re-fire the failing request every 2s forever
      // (data stays undefined, so the terminal-status check never trips).
      if (query.state.status === "error") return false;
      const status = query.state.data?.status;
      return status && TERMINAL_STATUSES.has(status)
        ? false
        : MESSAGE_STATUS_POLL_MS;
    },
    // Canonical polling pairing: always stale + evict on unmount, so the
    // refetchInterval is the sole source of truth (no stale snapshot on remount).
    staleTime: 0,
    gcTime: 0,
  });
}
