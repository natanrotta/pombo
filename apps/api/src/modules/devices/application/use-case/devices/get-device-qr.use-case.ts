import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import { IWhatsAppGateway } from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import type { DeviceQrResponseDTO } from "@pombo/shared-types";
import { NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * The current pairing QR for a device, for the connect modal's poll. The `qr`
 * is only present while the device is `QR_PENDING` (a QR is live and waiting to
 * be scanned); in every other status it is `null` — that is NOT an error, the
 * frontend uses `status` to decide what to render. Scoped by account (R1).
 *
 * The `status` (DB) and `qr` (in-process gateway cache) are two independent
 * reads, so a transient `{ status: "QR_PENDING", qr: null }` can occur: the QR
 * rotates ~every 30s, and right at a handshake/rotation boundary (or after a
 * process restart that lost the cache) the status may say QR_PENDING while the
 * cache is momentarily empty. This is self-healing — the frontend renders a
 * skeleton for that poll and the next 3s poll carries the fresh QR.
 */
@injectable()
export class GetDeviceQrUseCase {
  constructor(
    @inject(DI_TOKENS.DevicesRepository)
    private readonly devicesRepository: IDevicesRepository,
    @inject(DI_TOKENS.WhatsAppGateway)
    private readonly gateway: IWhatsAppGateway,
  ) {}

  async execute(accountId: string, id: string): Promise<DeviceQrResponseDTO> {
    const device = await this.devicesRepository.findById(accountId, id);
    if (!device) {
      throw new NotFoundError(
        "Device not found",
        undefined,
        ErrorCodes.DEVICE_NOT_FOUND,
      );
    }

    const qr =
      device.status === "QR_PENDING"
        ? this.gateway.getCurrentQr(device.id)
        : null;

    return { status: device.status, qr };
  }
}
