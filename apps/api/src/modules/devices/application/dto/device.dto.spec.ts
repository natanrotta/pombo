import type { z } from "zod";
import type {
  RegisterDeviceRequestDTO,
  UpdateDeviceWebhooksRequestDTO,
} from "@pombo/shared-types";
import {
  RegisterDeviceDTOSchema,
  UpdateDeviceWebhooksDTOSchema,
} from "./device.dto";

describe("device DTOs", () => {
  describe("RegisterDeviceDTOSchema", () => {
    it("accepts and trims a name", () => {
      const parsed = RegisterDeviceDTOSchema.parse({ name: "  my-phone  " });
      expect(parsed.name).toBe("my-phone");
    });

    it("rejects an empty name", () => {
      expect(() => RegisterDeviceDTOSchema.parse({ name: "" })).toThrow();
    });

    it("ignores a webhookUrl (registration is name-only now)", () => {
      const parsed = RegisterDeviceDTOSchema.parse({
        name: "phone",
        webhookUrl: "https://hook.example.com",
      });
      expect(parsed).toEqual({ name: "phone" });
      expect(parsed).not.toHaveProperty("webhookUrl");
    });
  });

  describe("UpdateDeviceWebhooksDTOSchema", () => {
    it("accepts http(s) URLs for any of the five hooks", () => {
      const parsed = UpdateDeviceWebhooksDTOSchema.parse({
        onConnect: "https://hook/connect",
        onSend: "http://hook/send",
      });
      expect(parsed.onConnect).toBe("https://hook/connect");
      expect(parsed.onSend).toBe("http://hook/send");
    });

    it("accepts null to clear a hook and an empty object", () => {
      expect(UpdateDeviceWebhooksDTOSchema.parse({ onReceive: null })).toEqual({
        onReceive: null,
      });
      expect(UpdateDeviceWebhooksDTOSchema.parse({})).toEqual({});
    });

    it("rejects a non-url and a non-http(s) scheme", () => {
      expect(() =>
        UpdateDeviceWebhooksDTOSchema.parse({ onConnect: "not-a-url" }),
      ).toThrow();
      expect(() =>
        UpdateDeviceWebhooksDTOSchema.parse({
          onConnect: "ftp://hook/connect",
        }),
      ).toThrow();
    });

    it("rejects unknown keys (strict)", () => {
      expect(() =>
        UpdateDeviceWebhooksDTOSchema.parse({ onWhatever: "https://x" }),
      ).toThrow();
    });
  });
});

describe("device request DTOs ↔ @pombo/shared-types", () => {
  it("accept exactly the body the shared contract declares", () => {
    // Type-level — enforced by `yarn type-check`: a schema that drifts from
    // the contract the web client sends breaks the build.
    expectTypeOf<
      z.input<typeof RegisterDeviceDTOSchema>
    >().toEqualTypeOf<RegisterDeviceRequestDTO>();
    expectTypeOf<
      z.input<typeof UpdateDeviceWebhooksDTOSchema>
    >().toEqualTypeOf<UpdateDeviceWebhooksRequestDTO>();
  });
});
