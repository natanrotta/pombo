import type { DeviceResponseDTO, DeviceWebhooks } from "@pombo/shared-types";
import { type DeviceStatus } from "../value-object/device-status";

/** Per-event webhook delivery URLs — declared in the shared wire contract. */
export type { DeviceWebhooks };

export interface DeviceProps {
  id: string;
  /** The tenant that owns this device (BASELINE R1). */
  accountId: string;
  name: string;
  /** null until pairing — WhatsApp is the source of truth for it. */
  identifier: string | null;
  status: DeviceStatus;
  /** Generated at registration, returned exactly once; never re-exposed. */
  webhookSecret: string | null;
  webhooks: DeviceWebhooks;
  lastConnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Device {
  private readonly props: DeviceProps;

  constructor(props: DeviceProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get name(): string {
    return this.props.name;
  }

  get identifier(): string | null {
    return this.props.identifier;
  }

  get status(): DeviceStatus {
    return this.props.status;
  }

  /** The socket is live — the only status that can send (ADR-005). */
  get isConnected(): boolean {
    return this.props.status === "CONNECTED";
  }

  get webhookSecret(): string | null {
    return this.props.webhookSecret;
  }

  get webhooks(): DeviceWebhooks {
    return this.props.webhooks;
  }

  get lastConnectedAt(): Date | null {
    return this.props.lastConnectedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Public wire projection returned by GET endpoints. NEVER leaks
   * `webhookSecret` (shown exactly once, at registration). The per-event
   * webhook URLs ARE exposed so the settings screen can populate the form.
   */
  public toJSON(): DeviceResponseDTO {
    return {
      id: this.id,
      name: this.name,
      identifier: this.identifier,
      status: this.status,
      webhooks: this.webhooks,
      lastConnectedAt: this.lastConnectedAt
        ? this.lastConnectedAt.toISOString()
        : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
