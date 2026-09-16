import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import { IWhatsAppGateway } from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import type { DeviceConnectionResponseDTO } from "@pombo/shared-types";
import { ConflictError, NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * Starts a connection: it does NOT wait for the human. Re-runnable (the
 * recovery path after logout). Validates, asks the gateway to connect, and
 * marks the device CONNECTING. When the gateway is disabled
 * (`WHATSAPP_ENABLED=false`) it fails clean with WA_GATEWAY_DISABLED instead of
 * crashing.
 */
@injectable()
export class ConnectDeviceUseCase {
  constructor(
    @inject(DI_TOKENS.DevicesRepository)
    private readonly devicesRepository: IDevicesRepository,
    @inject(DI_TOKENS.WhatsAppGateway)
    private readonly gateway: IWhatsAppGateway,
  ) {}

  async execute(
    accountId: string,
    id: string,
  ): Promise<DeviceConnectionResponseDTO> {
    const device = await this.devicesRepository.findById(accountId, id);
    if (!device) {
      throw new NotFoundError(
        "Device not found",
        undefined,
        ErrorCodes.DEVICE_NOT_FOUND,
      );
    }

    if (!this.gateway.isEnabled()) {
      throw new ConflictError(
        "The WhatsApp integration is disabled in this environment",
        undefined,
        ErrorCodes.WA_GATEWAY_DISABLED,
      );
    }

    if (device.isConnected || this.gateway.isConnected(device.id)) {
      throw new ConflictError(
        "The device is already connected",
        undefined,
        ErrorCodes.DEVICE_ALREADY_CONNECTED,
      );
    }

    await this.gateway.connect(device.id);
    const updated = await this.devicesRepository.updateStatus(
      device.id,
      "CONNECTING",
    );

    return { id: updated.id, status: updated.status };
  }
}
