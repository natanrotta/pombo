/** The message kinds the Sandbox can send. Mirrors the backend
 *  `outbox_message_type` enum. */
export type MessageType = "text" | "image" | "audio" | "video" | "document";

/** The compose options the Sandbox offers. `"group"` is a UI-only routing
 *  concept: a group send is a text message to a `@g.us` JID, stored on the
 *  backend as a `text` outbox row — it is NOT a backend `outbox_message_type`. */
export type SandboxMessageType = MessageType | "group";

export interface SendTextInput {
  phone: string;
  text: string;
}

export interface SendImageInput {
  phone: string;
  image: string;
  caption?: string;
}

export interface SendAudioInput {
  phone: string;
  audio: string;
}

export interface SendVideoInput {
  phone: string;
  video: string;
  caption?: string;
}

export interface SendDocumentInput {
  phone: string;
  document: string;
  fileName?: string;
  caption?: string;
}

/** Send a text message to a group. `groupJid` is the canonical `<id>@g.us`
 *  identifier (from `GET /devices/:id/groups`). */
export interface SendGroupInput {
  groupJid: string;
  text: string;
}

/** The delivery lifecycle of a message, mirroring the backend
 *  `message_status` enum. Rises monotonically; FAILED is terminal. */
export type MessageStatus =
  | "PENDING"
  | "SERVER_ACK"
  | "DELIVERY_ACK"
  | "READ"
  | "FAILED";

/** Mirrors the backend send 202 body. `202` means accepted + socket alive, NOT
 *  delivered. */
export interface SendMessageResult {
  messageId: string;
  status: MessageStatus;
}

/** Mirrors `GET /messages/:id` (the authoritative, pollable status). */
export interface MessageStatusResult {
  messageId: string;
  status: MessageStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
