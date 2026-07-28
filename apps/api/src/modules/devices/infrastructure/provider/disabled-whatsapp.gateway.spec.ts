import { IWhatsAppGateway } from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import { DisabledWhatsAppGateway } from "./disabled-whatsapp.gateway";

const JID = "5511999999999@s.whatsapp.net";

describe("DisabledWhatsAppGateway.setTyping", () => {
  // Presence is cosmetic and best-effort. Unlike the send* methods (which throw
  // WA_GATEWAY_DISABLED), setTyping must be a safe no-op so the humanized send
  // path never crashes in a WHATSAPP_ENABLED=false environment. Exercised through
  // the port — the exact shape the humanized drain (E3) will consume.
  it("is a safe no-op — resolves without throwing for on and off", async () => {
    const gateway: IWhatsAppGateway = new DisabledWhatsAppGateway();

    await expect(
      gateway.setTyping("device-1", JID, true),
    ).resolves.toBeUndefined();
    await expect(
      gateway.setTyping("device-1", JID, false),
    ).resolves.toBeUndefined();
  });
});
