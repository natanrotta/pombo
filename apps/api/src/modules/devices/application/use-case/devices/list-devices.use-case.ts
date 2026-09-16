import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import type { DeviceResponseDTO } from "@pombo/shared-types";

/** Lists every registered device (public projection — no webhookSecret). */
@injectable()
export class ListDevicesUseCase {
  constructor(
    @inject(DI_TOKENS.DevicesRepository)
    private readonly devicesRepository: IDevicesRepository,
  ) {}

  async execute(accountId: string): Promise<DeviceResponseDTO[]> {
    const devices = await this.devicesRepository.list(accountId);
    return devices.map((device) => device.toJSON());
  }
}
