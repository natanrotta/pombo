import { describe, expect, it } from "vitest";
import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  describe("hierarchy", () => {
    it("nests narrow keys under the entity's `all` root", () => {
      expect(queryKeys.messaging.messageStatus("msg-1")[0]).toBe("messaging");
      expect(queryKeys.devices.list()[0]).toBe("devices");
      expect(queryKeys.account.apiToken()[0]).toBe("account");
    });
  });

  describe("devices namespace", () => {
    it("nests list/detail/qr/groups under the devices root, encoding the id", () => {
      expect(queryKeys.devices.all).toEqual(["devices"]);
      expect(queryKeys.devices.list()).toEqual(["devices", "list"]);
      expect(queryKeys.devices.detail("dev-1")).toEqual(["devices", "detail", "dev-1"]);
      expect(queryKeys.devices.qr("dev-1")).toEqual(["devices", "qr", "dev-1"]);
      expect(queryKeys.devices.groups("dev-1")).toEqual([
        "devices",
        "groups",
        "dev-1",
      ]);
    });

    it("keeps detail and qr keys distinct for the same device id", () => {
      expect(queryKeys.devices.detail("dev-1")).not.toEqual(queryKeys.devices.qr("dev-1"));
    });
  });

  describe("account namespace", () => {
    it("exposes apiToken() under the account root", () => {
      expect(queryKeys.account.all).toEqual(["account"]);
      expect(queryKeys.account.apiToken()).toEqual(["account", "api-token"]);
    });
  });

  describe("messaging namespace", () => {
    it("nests messageStatus under the messaging root, encoding the id", () => {
      expect(queryKeys.messaging.all).toEqual(["messaging"]);
      expect(queryKeys.messaging.messageStatus("msg-1")).toEqual([
        "messaging",
        "message-status",
        "msg-1",
      ]);
    });
  });

  it("returns readonly tuples (compile-time guard)", () => {
    // Runtime check: the array must be a real array (the `as const` is a TS-only narrowing).
    const list = queryKeys.devices.list();
    expect(Array.isArray(list)).toBe(true);
  });
});
