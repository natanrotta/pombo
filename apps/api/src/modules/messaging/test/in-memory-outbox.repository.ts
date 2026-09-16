import { randomUUID } from "node:crypto";
import { OutboxMessage } from "@modules/messaging/domain/entity/outbox-message.entity";
import {
  IOutboxRepository,
  CreateOutboxData,
} from "@modules/messaging/domain/repository/outbox-repository.interface";
import { type MessageStatus } from "@modules/messaging/domain/value-object/message-status";
import { type MessageType } from "@modules/messaging/domain/value-object/message-type";
import { ConflictError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

interface Row {
  id: string;
  deviceId: string;
  idempotencyKey: string;
  toJid: string;
  type: MessageType;
  text: string | null;
  payload: unknown | null;
  waMessageId: string | null;
  status: MessageStatus;
  failureReason: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory `IOutboxRepository` for specs — mocks at the repository boundary
 * (R25). Enforces the same invariants the DB does (unique (deviceId, key),
 * unique waMessageId, atomic monotonic update).
 */
export class InMemoryOutboxRepository implements IOutboxRepository {
  private readonly rows = new Map<string, Row>();
  /** Which account owns a device — the DB resolves this through the relation. */
  private readonly deviceAccounts = new Map<string, string>();

  /** Test setup: put a device under an account so the account-wide count can
   *  see its queued messages. */
  linkDevice(deviceId: string, accountId: string): void {
    this.deviceAccounts.set(deviceId, accountId);
  }

  private toEntity(row: Row): OutboxMessage {
    return new OutboxMessage({ ...row });
  }

  async findById(id: string): Promise<OutboxMessage | null> {
    const row = this.rows.get(id);
    return row ? this.toEntity(row) : null;
  }

  async findByIdempotencyKey(
    deviceId: string,
    idempotencyKey: string,
  ): Promise<OutboxMessage | null> {
    for (const row of this.rows.values()) {
      if (row.deviceId === deviceId && row.idempotencyKey === idempotencyKey) {
        return this.toEntity(row);
      }
    }
    return null;
  }

  async findByWaMessageId(waMessageId: string): Promise<OutboxMessage | null> {
    for (const row of this.rows.values()) {
      if (row.waMessageId === waMessageId) return this.toEntity(row);
    }
    return null;
  }

  async create(data: CreateOutboxData): Promise<OutboxMessage> {
    if (await this.findByIdempotencyKey(data.deviceId, data.idempotencyKey)) {
      throw new ConflictError(
        "This Idempotency-Key was already used with a different payload",
        undefined,
        ErrorCodes.IDEMPOTENCY_KEY_CONFLICT,
      );
    }
    const now = new Date();
    const row: Row = {
      id: randomUUID(),
      deviceId: data.deviceId,
      idempotencyKey: data.idempotencyKey,
      toJid: data.toJid,
      type: data.type ?? "text",
      text: data.text ?? null,
      payload: data.payload ?? null,
      waMessageId: null,
      status: "PENDING",
      failureReason: null,
      expiresAt: data.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return this.toEntity(row);
  }

  async findQueued(deviceId: string, limit: number): Promise<OutboxMessage[]> {
    const now = Date.now();
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.deviceId === deviceId &&
          row.status === "PENDING" &&
          row.waMessageId === null &&
          row.expiresAt.getTime() > now,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit)
      .map((row) => this.toEntity(row));
  }

  async countQueuedForAccount(accountId: string): Promise<number> {
    const now = Date.now();
    return [...this.rows.values()].filter(
      (row) =>
        this.deviceAccounts.get(row.deviceId) === accountId &&
        row.status === "PENDING" &&
        row.waMessageId === null &&
        row.expiresAt.getTime() > now,
    ).length;
  }

  async setWaMessageId(id: string, waMessageId: string): Promise<void> {
    const row = this.rows.get(id);
    if (!row) return;
    row.waMessageId = waMessageId;
    row.updatedAt = new Date();
  }

  async updateStatus(
    id: string,
    status: MessageStatus,
    failureReason?: string | null,
  ): Promise<OutboxMessage> {
    const row = this.rows.get(id);
    if (!row) {
      throw new ConflictError(
        "Message not found",
        undefined,
        ErrorCodes.MESSAGE_NOT_FOUND,
      );
    }
    row.status = status;
    if (failureReason !== undefined) row.failureReason = failureReason;
    row.updatedAt = new Date();
    return this.toEntity(row);
  }

  async applyMonotonicStatus(
    waMessageId: string,
    status: MessageStatus,
    allowedFrom: MessageStatus[],
  ): Promise<OutboxMessage | null> {
    for (const row of this.rows.values()) {
      if (row.waMessageId === waMessageId && allowedFrom.includes(row.status)) {
        row.status = status;
        row.updatedAt = new Date();
        return this.toEntity(row);
      }
    }
    return null;
  }

  async pruneExpired(now: Date): Promise<number> {
    let count = 0;
    for (const [id, row] of this.rows.entries()) {
      if (row.expiresAt.getTime() < now.getTime()) {
        this.rows.delete(id);
        count += 1;
      }
    }
    return count;
  }
}
