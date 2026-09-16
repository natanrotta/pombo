import { container } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import type { AppConfig } from "@shared/provider/app-config.interface";
import type { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";

export interface GatewayHealth {
  devices: { total: number; connected: number };
}

/**
 * WhatsApp gateway status for the `GET /api/health` endpoint. Returns `null`
 * when `WHATSAPP_ENABLED=false` — the API reports healthy without touching
 * WhatsApp.
 *
 * This is INFORMATIONAL, not a liveness gate: it reports how many registered
 * devices are currently CONNECTED, but a disconnected device does NOT make the
 * process unhealthy. Individual sessions drop and reconnect all the time; the
 * process is fine as long as it's running (and it exits on advisory-lock loss).
 * Container liveness is `/healthz` (always 200), so a transiently-disconnected
 * device can never trip a restart and cause a mass drop.
 */
export async function getGatewayHealth(): Promise<GatewayHealth | null> {
  const config = container.resolve<AppConfig>(DI_TOKENS.AppConfig);
  if (!config.WHATSAPP_ENABLED) return null;

  const devicesRepository = container.resolve<IDevicesRepository>(
    DI_TOKENS.DevicesRepository,
  );
  // System probe — aggregates devices across every account (not tenant-scoped).
  const devices = await devicesRepository.listAll();
  const connected = devices.filter((device) => device.isConnected).length;

  return { devices: { total: devices.length, connected } };
}
