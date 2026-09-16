import type {
  Device,
  CreateDeviceInput,
  CreatedDevice,
  UpdateDeviceWebhooksInput,
  DeviceQr,
  DeviceGroup,
  ConnectDeviceResult,
  DisconnectDeviceResult,
} from "@/modules/devices/domain/entities/Device";

/**
 * Purpose-built contract rather than a generic CRUD one: the device domain is
 * non-CRUD (no pagination, `create` returns a one-time secret, `update` is
 * replaced by the webhook-only `updateWebhooks`, plus the pairing-specific
 * `connect`/`getQr`).
 */
export interface DeviceRepository {
  /** Reads take the query's `signal`, so a cancelled query aborts the request. */
  list(signal?: AbortSignal): Promise<Device[]>;
  getById(id: string, signal?: AbortSignal): Promise<Device>;
  create(input: CreateDeviceInput): Promise<CreatedDevice>;
  updateWebhooks(id: string, input: UpdateDeviceWebhooksInput): Promise<Device>;
  connect(id: string): Promise<ConnectDeviceResult>;
  disconnect(id: string): Promise<DisconnectDeviceResult>;
  getQr(id: string, signal?: AbortSignal): Promise<DeviceQr>;
  listGroups(id: string, signal?: AbortSignal): Promise<DeviceGroup[]>;
  delete(id: string): Promise<void>;
}
