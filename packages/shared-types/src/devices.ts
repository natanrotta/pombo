// ------------------------------------------------------------------
// Devices — `/api/devices/*` wire contract. Dates are ISO-8601 strings.
// ------------------------------------------------------------------

/** Lifecycle of a WhatsApp device socket. Mirrors the Prisma `device_status`
 *  enum (pinned by the API's wire-contract spec). Only `CONNECTED` can send. */
export const DEVICE_STATUSES = [
  "DISCONNECTED",
  "CONNECTING",
  "QR_PENDING",
  "CONNECTED",
  "LOGGED_OUT",
] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

/**
 * Per-event webhook delivery URLs. One HMAC `webhookSecret` (per device) signs
 * every event; each URL is where that event type is POSTed. `null` means
 * "don't deliver this event". `onReceive` is stored but dormant — inbound
 * messages are not processed yet.
 */
export interface DeviceWebhooks {
  onConnect: string | null;
  onDisconnect: string | null;
  onReceive: string | null;
  onMessageStatus: string | null;
  onSend: string | null;
}

/** `GET /devices`, `GET /devices/:id`, `PATCH /devices/:id/webhooks`. Never
 *  carries the `webhookSecret`. */
export interface DeviceResponseDTO {
  id: string;
  name: string;
  /** The paired WhatsApp number — `null` until pairing. */
  identifier: string | null;
  status: DeviceStatus;
  webhooks: DeviceWebhooks;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `POST /devices` body. */
export interface RegisterDeviceRequestDTO {
  /** 1–100 chars, unique within the account (`DEVICE_NAME_TAKEN`). */
  name: string;
}

/** `POST /devices` 201 — the only time the `webhookSecret` is ever returned. */
export interface RegisterDeviceResponseDTO {
  id: string;
  webhookSecret: string;
}

/** `PATCH /devices/:id/webhooks` body. Partial: an absent key leaves the URL
 *  unchanged, `null` clears it. Unknown keys are rejected. */
export type UpdateDeviceWebhooksRequestDTO = Partial<DeviceWebhooks>;

/** `GET /devices/:id/qr` — polled while pairing. `qr` is non-null only while
 *  `status === "QR_PENDING"`; `{ QR_PENDING, null }` is a legal transient. */
export interface DeviceQrResponseDTO {
  status: DeviceStatus;
  /** Raw QR payload to render — not an image. */
  qr: string | null;
}

/** `GET /devices/:id/groups` item. `jid` (`<id>@g.us`) is the recipient of a
 *  group send. Needs a live socket (`DEVICE_OFFLINE` otherwise). */
export interface DeviceGroupDTO {
  jid: string;
  name: string;
}

/** `POST /devices/:id/connect` (202 — accepted, not connected yet) and
 *  `POST /devices/:id/disconnect` (200). */
export interface DeviceConnectionResponseDTO {
  id: string;
  status: DeviceStatus;
}
