/**
 * Messaging vocabulary for the web module. The wire contract is declared once
 * in `@pombo/shared-types`; these aliases only give it the module's names.
 */
import type {
  MessageStatusResponseDTO,
  MessageType,
  SendAudioMessageRequestDTO,
  SendDocumentMessageRequestDTO,
  SendGroupMessageRequestDTO,
  SendImageMessageRequestDTO,
  SendMessageResponseDTO,
  SendTextMessageRequestDTO,
  SendVideoMessageRequestDTO,
} from "@pombo/shared-types";

export type { MessageStatus, MessageType } from "@pombo/shared-types";

/** The compose options the Sandbox offers. `"group"` is a UI-only routing
 *  concept: a group send is a text message to a `@g.us` JID, stored on the
 *  backend as a `text` outbox row — it is NOT a backend message type. */
export type SandboxMessageType = MessageType | "group";

export type SendTextInput = SendTextMessageRequestDTO;
export type SendGroupInput = SendGroupMessageRequestDTO;
export type SendImageInput = SendImageMessageRequestDTO;
export type SendAudioInput = SendAudioMessageRequestDTO;
export type SendVideoInput = SendVideoMessageRequestDTO;
export type SendDocumentInput = SendDocumentMessageRequestDTO;
/** `202` means accepted, NOT delivered. */
export type SendMessageResult = SendMessageResponseDTO;
/** `GET /messages/:id` — the authoritative, pollable status. */
export type MessageStatusResult = MessageStatusResponseDTO;
