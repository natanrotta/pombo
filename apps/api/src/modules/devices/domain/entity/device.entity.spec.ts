import { makeDevice } from "@modules/devices/test/device.factory";

describe("Device entity", () => {
  it("exposes props via getters", () => {
    const device = makeDevice({
      id: "d-1",
      name: "phone",
      status: "CONNECTED",
      identifier: "5599",
    });
    expect(device.id).toBe("d-1");
    expect(device.name).toBe("phone");
    expect(device.status).toBe("CONNECTED");
    expect(device.identifier).toBe("5599");
  });

  it("isConnected is true only for the CONNECTED status", () => {
    expect(makeDevice({ status: "CONNECTED" }).isConnected).toBe(true);
    for (const status of [
      "DISCONNECTED",
      "CONNECTING",
      "QR_PENDING",
      "LOGGED_OUT",
    ] as const) {
      expect(makeDevice({ status }).isConnected).toBe(false);
    }
  });

  it("toJSON never leaks the webhookSecret, exposes the webhook URLs, and ISO-formats dates", () => {
    const device = makeDevice({
      webhookSecret: "top-secret",
      webhooks: {
        onConnect: "https://hook/connect",
        onDisconnect: null,
        onReceive: null,
        onMessageStatus: null,
        onSend: "https://hook/send",
      },
      lastConnectedAt: new Date("2025-02-02T00:00:00.000Z"),
    });
    const json = device.toJSON();
    expect(json).not.toHaveProperty("webhookSecret");
    expect(json.webhooks.onConnect).toBe("https://hook/connect");
    expect(json.webhooks.onSend).toBe("https://hook/send");
    expect(json.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(json.lastConnectedAt).toBe("2025-02-02T00:00:00.000Z");
  });

  it("toJSON emits null lastConnectedAt when never connected", () => {
    const device = makeDevice({ lastConnectedAt: null });
    expect(device.toJSON().lastConnectedAt).toBeNull();
  });
});
