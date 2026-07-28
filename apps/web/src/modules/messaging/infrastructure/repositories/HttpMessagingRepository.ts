import { httpClient } from "@/core/http/httpClient";
import type { MessagingRepository } from "@/modules/messaging/domain/repositories/MessagingRepository";
import type {
  SendTextInput,
  SendImageInput,
  SendAudioInput,
  SendVideoInput,
  SendDocumentInput,
  SendGroupInput,
  SendMessageResult,
  MessageStatusResult,
} from "@/modules/messaging/domain/entities/Message";

/** A unique idempotency key per send. `crypto.randomUUID` only exists in a
 *  secure context (HTTPS/localhost), so fall back to a non-crypto unique string
 *  on plain-HTTP dev origins — uniqueness (not entropy) is all the header needs. */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pmb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// The httpClient response interceptor unwraps `{ ok, data }` → each call
// resolves to the inner `data` directly.
export class HttpMessagingRepository implements MessagingRepository {
  sendText(deviceId: string, input: SendTextInput): Promise<SendMessageResult> {
    return this.send(`/devices/${deviceId}/messages`, input);
  }

  sendGroupText(
    deviceId: string,
    input: SendGroupInput,
  ): Promise<SendMessageResult> {
    return this.send(`/devices/${deviceId}/messages/group`, input);
  }

  sendImage(
    deviceId: string,
    input: SendImageInput,
  ): Promise<SendMessageResult> {
    return this.send(`/devices/${deviceId}/messages/image`, input);
  }

  sendAudio(
    deviceId: string,
    input: SendAudioInput,
  ): Promise<SendMessageResult> {
    return this.send(`/devices/${deviceId}/messages/audio`, input);
  }

  sendVideo(
    deviceId: string,
    input: SendVideoInput,
  ): Promise<SendMessageResult> {
    return this.send(`/devices/${deviceId}/messages/video`, input);
  }

  sendDocument(
    deviceId: string,
    input: SendDocumentInput,
  ): Promise<SendMessageResult> {
    return this.send(`/devices/${deviceId}/messages/document`, input);
  }

  getStatus(messageId: string): Promise<MessageStatusResult> {
    return httpClient.get<never, MessageStatusResult>(
      `/messages/${messageId}`,
    );
  }

  /** Every send needs a unique Idempotency-Key (required by the endpoint). The
   *  sandbox is throwaway, so a fresh key per click is exactly right. */
  private send<TInput>(
    path: string,
    input: TInput,
  ): Promise<SendMessageResult> {
    return httpClient.post<TInput, SendMessageResult>(path, input, {
      headers: { "Idempotency-Key": newIdempotencyKey() },
    });
  }
}
