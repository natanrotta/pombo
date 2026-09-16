// ------------------------------------------------------------------
// Messaging — send + status wire contract. Every send is `202 Accepted`
// (queued, NOT delivered) and requires an `Idempotency-Key` header.
// ------------------------------------------------------------------

/** Content kind of a sent message. Mirrors the Prisma `outbox_message_type`
 *  enum. A group send is a `text` message to a `@g.us` JID. */
export const MESSAGE_TYPES = ["text", "image", "audio", "video", "document"] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

/** Delivery lifecycle. Mirrors the Prisma `message_status` enum. Rises
 *  monotonically (`PENDING → SERVER_ACK → DELIVERY_ACK → READ`); `FAILED` is
 *  reachable from anything except `READ`. */
export const MESSAGE_STATUSES = [
  "PENDING",
  "SERVER_ACK",
  "DELIVERY_ACK",
  "READ",
  "FAILED",
] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

// Media fields accept a URL or base64, but the API caps JSON bodies at 10 KB —
// in practice they are URLs.

/** `POST /devices/:id/messages` body. */
export interface SendTextMessageRequestDTO {
  phone: string;
  text: string;
}

/** `POST /devices/:id/messages/group` body. `groupJid` comes from
 *  `GET /devices/:id/groups`. */
export interface SendGroupMessageRequestDTO {
  groupJid: string;
  text: string;
}

/** `POST /devices/:id/messages/image` body. */
export interface SendImageMessageRequestDTO {
  phone: string;
  image: string;
  caption?: string;
}

/** `POST /devices/:id/messages/audio` body. */
export interface SendAudioMessageRequestDTO {
  phone: string;
  audio: string;
}

/** `POST /devices/:id/messages/video` body. */
export interface SendVideoMessageRequestDTO {
  phone: string;
  video: string;
  caption?: string;
}

/** `POST /devices/:id/messages/document` body. */
export interface SendDocumentMessageRequestDTO {
  phone: string;
  document: string;
  fileName?: string;
  caption?: string;
}

/** Every send's 202 body. `status` is the acceptance status (`PENDING`, or
 *  the stored status on an idempotent replay) — poll `GET /messages/:id`. */
export interface SendMessageResponseDTO {
  messageId: string;
  status: MessageStatus;
}

/** `GET /messages/queue` — the account's send backlog, for the device-list
 *  counter. */
export interface QueueSummaryResponseDTO {
  /** Messages accepted but not yet handed to WhatsApp. */
  pending: number;
}

/** `GET /messages/:id` — the authoritative, pollable status. Never carries the
 *  recipient or the content. */
export interface MessageStatusResponseDTO {
  messageId: string;
  status: MessageStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
