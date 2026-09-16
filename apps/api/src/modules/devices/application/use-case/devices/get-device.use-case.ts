import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import type { DeviceResponseDTO } from "@pombo/shared-types";
import { NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/** The authoritative state of a device. Throws NotFound when it doesn't exist. */
@injectable()
export class GetDeviceUseCase {
  constructor(
    @inject(DI_TOKENS.DevicesRepository)
    private readonly devicesRepository: IDevicesRepository,
  ) {}

  async execute(accountId: string, id: string): Promise<DeviceResponseDTO> {
    const device = await this.devicesRepository.findById(accountId, id);
    if (!device) {
      throw new NotFoundError(
        "Device not found",
        undefined,
        ErrorCodes.DEVICE_NOT_FOUND,
      );
    }
    return device.toJSON();
  }
}
