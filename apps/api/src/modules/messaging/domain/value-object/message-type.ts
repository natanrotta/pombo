import type { MessageType } from "@pombo/shared-types";

/**
 * The content kind of an outbox message. Declared in the shared wire contract
 * and mirrored by the Prisma `outbox_message_type` enum (pinned by
 * `message-type.spec.ts`). `text` uses the row's `text`
 * column; every other kind stores its validated body in `payload` (JSON) and is
 * dispatched to the matching gateway method by `dispatchOutboxSend`.
 */
export type { MessageType };

/** Every non-text kind — the ones carried by `SendRichMessageUseCase`. */
export const RICH_MESSAGE_TYPES = [
  "image",
  "audio",
  "video",
  "document",
] as const satisfies readonly MessageType[];

export type RichMessageType = (typeof RICH_MESSAGE_TYPES)[number];
