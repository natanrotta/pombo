/**
 * Device vocabulary for the web module. The wire contract is declared once in
 * `@pombo/shared-types` (the API types its responses with the same DTOs); these
 * aliases only give it the module's names.
 */
import type {
  DeviceConnectionResponseDTO,
  DeviceGroupDTO,
  DeviceQrResponseDTO,
  DeviceResponseDTO,
  RegisterDeviceRequestDTO,
  RegisterDeviceResponseDTO,
  UpdateDeviceWebhooksRequestDTO,
} from "@pombo/shared-types";

export type { DeviceStatus, DeviceWebhooks } from "@pombo/shared-types";

export type Device = DeviceResponseDTO;
export type CreateDeviceInput = RegisterDeviceRequestDTO;
/** Returned once at registration — carries the one-time webhookSecret. */
export type CreatedDevice = RegisterDeviceResponseDTO;
export type UpdateDeviceWebhooksInput = UpdateDeviceWebhooksRequestDTO;
export type DeviceQr = DeviceQrResponseDTO;
export type DeviceGroup = DeviceGroupDTO;
export type ConnectDeviceResult = DeviceConnectionResponseDTO;
export type DisconnectDeviceResult = DeviceConnectionResponseDTO;
