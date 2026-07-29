export type DeviceStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "QR_PENDING"
  | "CONNECTED"
  | "LOGGED_OUT";

/** Per-event webhook delivery URLs (null = not configured). `onReceive` is
 *  persisted but dormant in this version — no inbound event fires it yet. */
export interface DeviceWebhooks {
  onConnect: string | null;
  onDisconnect: string | null;
  onReceive: string | null;
  onMessageStatus: string | null;
  onSend: string | null;
}

/** Mirrors the backend `Device.toJSON()` wire shape 1:1. */
export interface Device {
  id: string;
  name: string;
  /** The paired WhatsApp number — null until connected. */
  identifier: string | null;
  status: DeviceStatus;
  webhooks: DeviceWebhooks;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviceInput {
  name: string;
}

/** Returned once at registration — carries the one-time webhookSecret. */
export interface CreatedDevice {
  id: string;
  webhookSecret: string;
}

/** Partial per-event webhook update: only the provided keys are written
 *  (`null` clears a URL, an absent key leaves it unchanged). */
export type UpdateDeviceWebhooksInput = Partial<DeviceWebhooks>;

export interface DeviceQr {
  status: DeviceStatus;
  /** The pairing QR string — non-null only while `status === "QR_PENDING"`. */
  qr: string | null;
}

/** A WhatsApp group the device participates in. Mirrors the backend
 *  `GroupInfo` (keep in sync). `jid` (`<id>@g.us`) is the send recipient. */
export interface DeviceGroup {
  jid: string;
  name: string;
}

export interface ConnectDeviceResult {
  id: string;
  status: DeviceStatus;
}

export interface DisconnectDeviceResult {
  id: string;
  status: DeviceStatus;
}
