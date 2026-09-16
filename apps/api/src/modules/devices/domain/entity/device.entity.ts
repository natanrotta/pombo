import { type DeviceStatus } from "../value-object/device-status";

/**
 * Per-event webhook delivery URLs. One HMAC `webhookSecret` (on the device)
 * signs every event; each URL is where that event type is POSTed. A null URL
 * means "don't deliver this event". `onReceive` is persisted but dormant in
 * this version (inbound messages are not processed — see PLANO §4).
 */
export interface DeviceWebhooks {
  onConnect: string | null;
  onDisconnect: string | null;
  onReceive: string | null;
  onMessageStatus: string | null;
  onSend: string | null;
}

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
  public toJSON() {
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
