import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import {
  IWhatsAppGateway,
  GroupInfo,
} from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import { NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * The WhatsApp groups a device participates in, for the API consumer to discover
 * a group's identifier (`<id>@g.us`) before sending to it. Scoped by account
 * (R1/R3): an unknown or cross-account device is a `DEVICE_NOT_FOUND`, never a
 * leak. The list is live — `groupFetchAllParticipating` needs an open socket, so
 * an offline device surfaces the gateway's `DEVICE_OFFLINE` (503); there is no
 * queue for a read.
 */
@injectable()
export class ListDeviceGroupsUseCase {
  constructor(
    @inject(DI_TOKENS.DevicesRepository)
    private readonly devicesRepository: IDevicesRepository,
    @inject(DI_TOKENS.WhatsAppGateway)
    private readonly gateway: IWhatsAppGateway,
  ) {}

  async execute(accountId: string, id: string): Promise<GroupInfo[]> {
    const device = await this.devicesRepository.findById(accountId, id);
    if (!device) {
      throw new NotFoundError(
        "Device not found",
        undefined,
        ErrorCodes.DEVICE_NOT_FOUND,
      );
    }
    return this.gateway.listGroups(device.id);
  }
}
