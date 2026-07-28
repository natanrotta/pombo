/**
 * The cross-module domain event bus (pombo WhatsApp gateway).
 *
 * Distinct from `IEventBus` (the Redis pub/sub string bus used for SSE
 * fan-out): this is a typed, in-process bus carrying the WhatsApp session +
 * message-status vocabulary. The Baileys adapter (in `modules/devices`)
 * translates `sock.ev` → `DomainEvent` and publishes; `messaging` and
 * `webhooks` subscribe. `devices` never imports `webhooks` — they only meet on
 * this bus.
 *
 * Two message events, deliberately distinct:
 *  - `session.message_status` (raw, waMessageId): published by the adapter,
 *    consumed by `messaging` to apply the monotonic guard.
 *  - `message.status` (business, outbox messageId): republished by `messaging`
 *    AFTER a real monotonic rise, consumed by `webhooks`. This is why the
 *    webhook never regresses and `webhooks` never touches the outbox.
 */

export type DomainMessageStatus =
  "PENDING" | "SERVER_ACK" | "DELIVERY_ACK" | "READ" | "FAILED";

export type DomainEvent =
  | { type: "session.qr"; deviceId: string; qr: string }
  | { type: "session.connected"; deviceId: string; identifier: string }
  | { type: "session.disconnected"; deviceId: string; reason: string }
  | { type: "session.logged_out"; deviceId: string }
  | {
      type: "session.message_status";
      deviceId: string;
      waMessageId: string;
      status: DomainMessageStatus;
    }
  | {
      type: "message.status";
      deviceId: string;
      messageId: string;
      status: DomainMessageStatus;
    }
  | {
      // Published by `messaging` right after the gateway accepts an outbound
      // send, consumed by `webhooks`. Carries NO message text (privacy — the
      // webhook only signals that a send happened, not what was sent).
      type: "message.sent";
      deviceId: string;
      messageId: string;
      /** The recipient: a phone number for an individual send, or the group JID
       *  (`<id>@g.us`) for a group send. Kept named `phone` for webhook
       *  backward-compatibility; a `recipient` rename is a breaking change. */
      phone: string;
    };

export type DomainEventType = DomainEvent["type"];

export interface IDomainEventBus {
  /** Fire-and-forget publish. A throwing subscriber never breaks the publisher
   *  or its siblings. */
  publish(event: DomainEvent): void;
  /** Subscribe a handler to a single event type. */
  subscribe<T extends DomainEventType>(
    type: T,
    handler: (event: Extract<DomainEvent, { type: T }>) => Promise<void>,
  ): void;
}
