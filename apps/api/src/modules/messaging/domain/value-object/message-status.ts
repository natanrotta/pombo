import type { MessageStatus } from "@pombo/shared-types";

/**
 * The message-delivery status vocabulary + the monotonic transition rule. The
 * vocabulary is declared in the shared wire contract and mirrored by the
 * Prisma `message_status` enum (pinned by `message-status.spec.ts`).
 */
export type { MessageStatus };

/** Every status, for computing the "allowed-from" set of a transition. */
export { MESSAGE_STATUSES } from "@pombo/shared-types";

const RANK: Record<MessageStatus, number> = {
  PENDING: 0,
  SERVER_ACK: 1,
  DELIVERY_ACK: 2,
  READ: 3,
  FAILED: 4,
};

/**
 * Pure domain rule. Protects against out-of-order acks: status only rises
 * (PENDING → SERVER_ACK → DELIVERY_ACK → READ); FAILED is allowed from anything
 * except READ. A `read` arriving before a `delivery_ack` must not regress.
 */
export const canTransitionTo = (
  from: MessageStatus,
  to: MessageStatus,
): boolean => (to === "FAILED" ? from !== "READ" : RANK[to] > RANK[from]);
