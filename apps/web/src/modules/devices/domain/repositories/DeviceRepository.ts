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
 * Intentionally does NOT extend the generic `CrudRepository`: the device domain
 * is non-CRUD (no pagination, `create` returns a one-time secret, `update` is
 * replaced by the webhook-only `updateWebhooks`, plus the pairing-specific
 * `connect`/`getQr`). Kept as a purpose-built contract.
 */
export interface DeviceRepository {
  list(): Promise<Device[]>;
  getById(id: string): Promise<Device>;
  create(input: CreateDeviceInput): Promise<CreatedDevice>;
  updateWebhooks(
    id: string,
    input: UpdateDeviceWebhooksInput,
  ): Promise<Device>;
  connect(id: string): Promise<ConnectDeviceResult>;
  disconnect(id: string): Promise<DisconnectDeviceResult>;
  getQr(id: string): Promise<DeviceQr>;
  listGroups(id: string): Promise<DeviceGroup[]>;
  delete(id: string): Promise<void>;
}
