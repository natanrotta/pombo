import type { MessageStatusResponseDTO } from "@pombo/shared-types";
import { type MessageStatus } from "../value-object/message-status";
import { type MessageType } from "../value-object/message-type";

export interface OutboxMessageProps {
  id: string;
  deviceId: string;
  idempotencyKey: string;
  toJid: string;
  /** The content kind. `text` uses `text`; every rich kind uses `payload`. */
  type: MessageType;
  /** Set only for `text` messages (getMessage asks Baileys for the original
   *  text on a resend). Null for rich types. */
  text: string | null;
  /** The validated send body for rich (non-text) messages; null for `text`.
   *  The drain reads it back to replay the original send. */
  payload: unknown | null;
  waMessageId: string | null;
  status: MessageStatus;
  failureReason: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class OutboxMessage {
  private readonly props: OutboxMessageProps;

  constructor(props: OutboxMessageProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get deviceId(): string {
    return this.props.deviceId;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get toJid(): string {
    return this.props.toJid;
  }

  get type(): MessageType {
    return this.props.type;
  }

  get text(): string | null {
    return this.props.text;
  }

  get payload(): unknown | null {
    return this.props.payload;
  }

  get waMessageId(): string | null {
    return this.props.waMessageId;
  }

  get status(): MessageStatus {
    return this.props.status;
  }

  get failureReason(): string | null {
    return this.props.failureReason;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Public status projection. The outbox stores `text`/`toJid` for protocol
   * reasons — those are never leaked; the consumer only ever sees the status.
   */
  public toJSON(): MessageStatusResponseDTO {
    return {
      messageId: this.id,
      status: this.status,
      failureReason: this.failureReason,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
