import { ListDeviceGroupsUseCase } from "./list-device-groups.use-case";
import { RegisterDeviceUseCase } from "./register-device.use-case";
import { InMemoryDevicesRepository } from "@modules/devices/test/in-memory-devices.repository";
import { FakeWhatsAppGateway } from "@modules/devices/test/fake-whatsapp.gateway";
import { ErrorCodes } from "@shared/error/error-codes";

const ACCOUNT_A = "account-a";
const ACCOUNT_B = "account-b";

const setup = async () => {
  const devices = new InMemoryDevicesRepository();
  const gateway = new FakeWhatsAppGateway();
  const { id } = await new RegisterDeviceUseCase(devices).execute(ACCOUNT_A, {
    name: "phone",
  });
  const sut = new ListDeviceGroupsUseCase(devices, gateway);
  return { devices, gateway, id, sut };
};

describe("ListDeviceGroupsUseCase", () => {
  it("returns the groups of a connected device", async () => {
    const { gateway, id, sut } = await setup();
    gateway.setConnected(id, true);
    gateway.setGroups(id, [
      { jid: "120363000000000001@g.us", name: "Team" },
      { jid: "120363000000000002@g.us", name: "Family" },
    ]);

    const result = await sut.execute(ACCOUNT_A, id);

    expect(result).toEqual([
      { jid: "120363000000000001@g.us", name: "Team" },
      { jid: "120363000000000002@g.us", name: "Family" },
    ]);
  });

  it("returns an empty list when the connected device has no groups", async () => {
    const { gateway, id, sut } = await setup();
    gateway.setConnected(id, true);

    const result = await sut.execute(ACCOUNT_A, id);

    expect(result).toEqual([]);
  });

  it("surfaces DEVICE_OFFLINE when the device is not connected", async () => {
    const { id, sut } = await setup();

    await expect(sut.execute(ACCOUNT_A, id)).rejects.toMatchObject({
      code: ErrorCodes.DEVICE_OFFLINE,
    });
  });

  it("throws DEVICE_NOT_FOUND for an unknown device", async () => {
    const { sut } = await setup();

    await expect(sut.execute(ACCOUNT_A, "nope")).rejects.toMatchObject({
      code: ErrorCodes.DEVICE_NOT_FOUND,
    });
  });

  it("throws DEVICE_NOT_FOUND for a device owned by another account (R3)", async () => {
    const { gateway, id, sut } = await setup();
    gateway.setConnected(id, true);
    gateway.setGroups(id, [{ jid: "120363000000000001@g.us", name: "Team" }]);

    await expect(sut.execute(ACCOUNT_B, id)).rejects.toMatchObject({
      code: ErrorCodes.DEVICE_NOT_FOUND,
    });
  });
});
