import { DEVICE_STATUSES, type DeviceStatus } from "@pombo/shared-types";
import { device_status } from "@generated/prisma/enums";

/**
 * Wire-contract pin: the status vocabulary is declared once in
 * `@pombo/shared-types` and must stay identical to the Prisma enum, or a row
 * status the API reads would be one the web client can't render.
 */
describe("DeviceStatus wire contract", () => {
  it("matches the Prisma device_status enum", () => {
    expect([...DEVICE_STATUSES].sort()).toEqual(
      Object.values(device_status).sort(),
    );
    // Type-level half — enforced by `yarn type-check` (specs are type-checked).
    expectTypeOf<DeviceStatus>().toEqualTypeOf<device_status>();
  });
});
