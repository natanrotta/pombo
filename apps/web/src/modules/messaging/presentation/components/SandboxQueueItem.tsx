import { memo, useState } from "react";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import { useMessageStatus } from "@/modules/messaging/presentation/hooks/useSendMessage";
import type {
  MessageStatus,
  SendMessageResult,
} from "@/modules/messaging/domain/entities/Message";

/** One enqueued send tracked by the Sandbox queue — the 202 body kept in memory. */
export type SandboxQueueEntry = SendMessageResult;

/** How long a row may sit PENDING before we explain the pacer's queue. */
const LONG_PENDING_MS = 15_000;

const STATUS_TONE: Record<
  MessageStatus,
  "neutral" | "info" | "success" | "error"
> = {
  PENDING: "neutral",
  SERVER_ACK: "info",
  DELIVERY_ACK: "info",
  READ: "success",
  FAILED: "error",
};

interface SandboxQueueItemProps {
  messageId: string;
  index: number;
  total: number;
  /** The 202's PENDING status, shown until the first poll lands. */
  initialStatus: MessageStatus;
}

/** A single row of the Sandbox send queue. Owns its OWN live-status poll (stops
 *  at READ/FAILED), so every queued message tracks its drain independently —
 *  which is exactly how the humanized pacing becomes visible: earlier rows climb
 *  to SERVER_ACK/READ while later ones sit PENDING, spaced out by the drain's
 *  typing window and long pauses. */
export const SandboxQueueItem = memo(function SandboxQueueItem({
  messageId,
  index,
  total,
  initialStatus,
}: SandboxQueueItemProps) {
  const { t } = useTranslation("sandbox");

  const statusQuery = useMessageStatus(messageId, true);
  const status: MessageStatus = statusQuery.data?.status ?? initialStatus;
  const failureReason = statusQuery.data?.failureReason ?? null;
  const isError = statusQuery.isError;
  const isPolling = status !== "READ" && status !== "FAILED" && !isError;

  // Client clock only: when the row first rendered vs. its latest poll. The
  // 2s poll re-renders the row, so no timer of its own is needed.
  const [shownAt] = useState(() => Date.now());
  const waitedMs = statusQuery.dataUpdatedAt - shownAt;
  const showPacingHint =
    status === "PENDING" && !isError && waitedMs > LONG_PENDING_MS;

  return (
    <Flex
      direction="column"
      gap={1}
      py={2.5}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      _last={{ borderBottomWidth: 0 }}
    >
      <Flex align="center" justify="space-between" gap={3}>
        <Text fontSize="sm" fontWeight="600" color="text.primary">
          {t("queue.item", { index, total })}
        </Text>
        <Flex align="center" gap={2} flexShrink={0}>
          {isPolling && <Spinner size="xs" color="text.muted" />}
          <StatusBadge
            status={STATUS_TONE[status]}
            label={t(`status.${status}`)}
          />
        </Flex>
      </Flex>
      <Text fontSize="xs" color="text.muted" wordBreak="break-all">
        {messageId}
      </Text>
      {showPacingHint && (
        <Text fontSize="xs" color="text.muted">
          {t("queue.pacingPending")}
        </Text>
      )}
      {failureReason && (
        <Text fontSize="xs" color="status.error.fg">
          {failureReason}
        </Text>
      )}
    </Flex>
  );
});
