import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import { IWhatsAppGateway } from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import type { DeviceConnectionResponseDTO } from "@pombo/shared-types";
import { NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * Ends a device's WhatsApp session WITHOUT deleting it. Unpairs via
 * `gateway.logout` (a safe no-op when the gateway is disabled) and marks the
 * device DISCONNECTED so list/detail reflect it immediately. Idempotent — safe
 * to call on an already-disconnected device. Reconnecting takes the normal
 * connect + QR path (the connect use case is the "recovery after logout" flow).
 */
@injectable()
export class DisconnectDeviceUseCase {
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

    await this.gateway.logout(device.id);
    const updated = await this.devicesRepository.updateStatus(
      device.id,
      "DISCONNECTED",
    );

    return { id: updated.id, status: updated.status };
  }
}
