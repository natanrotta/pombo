import { OutboxMessage } from "../entity/outbox-message.entity";
import { type MessageStatus } from "../value-object/message-status";
import { type MessageType } from "../value-object/message-type";

export interface CreateOutboxData {
  deviceId: string;
  idempotencyKey: string;
  toJid: string;
  /** Defaults to `text` when omitted — keeps the text send path unchanged. */
  type?: MessageType;
  /** Set for `text` messages. */
  text?: string | null;
  /** Set for rich (non-text) messages — the validated send body. */
  payload?: unknown | null;
  expiresAt: Date;
}

/**
 * The port the application depends on. Idempotency is enforced by the DB unique
 * (device_id, idempotency_key) — create throws on a duplicate. The outbox is
 * protocol, not history: pruneExpired drops rows past their TTL.
 */
export interface IOutboxRepository {
  findById(id: string): Promise<OutboxMessage | null>;
  findByIdempotencyKey(
    deviceId: string,
    idempotencyKey: string,
  ): Promise<OutboxMessage | null>;
  findByWaMessageId(waMessageId: string): Promise<OutboxMessage | null>;
  create(data: CreateOutboxData): Promise<OutboxMessage>;
  /**
   * Messages queued for a device but not yet sent — `PENDING`, no `wa_message_id`
   * (never handed to WhatsApp), still within TTL. FIFO by creation, capped at
   * `limit` so a device with a huge backlog can't load it all at once (the drain
   * re-queries in batches). This is the set reopened when the device reconnects.
   */
  findQueued(deviceId: string, limit: number): Promise<OutboxMessage[]>;
  /**
   * How many messages are waiting to be sent across every device of an account
   * — the same set `findQueued` reopens per device, counted account-wide for
   * the dashboard counter.
   */
  countQueuedForAccount(accountId: string): Promise<number>;
  setWaMessageId(id: string, waMessageId: string): Promise<void>;
  updateStatus(
    id: string,
    status: MessageStatus,
    failureReason?: string | null,
  ): Promise<OutboxMessage>;
  /**
   * Atomic monotonic status write: sets `status` only if the row's current
   * status is in `allowedFrom`, matched by waMessageId. The transition guard is
   * a DB predicate, so two concurrent acks can't regress it. Returns the
   * UPDATED row (or null for a no-op — unknown/pruned waMessageId or a
   * stale/regressing ack).
   */
  applyMonotonicStatus(
    waMessageId: string,
    status: MessageStatus,
    allowedFrom: MessageStatus[],
  ): Promise<OutboxMessage | null>;
  pruneExpired(now: Date): Promise<number>;
}
