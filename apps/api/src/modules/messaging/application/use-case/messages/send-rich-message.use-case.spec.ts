import { SendRichMessageUseCase } from "./send-rich-message.use-case";
import type { DrainOutboxUseCase } from "./drain-outbox.use-case";
import { InMemoryDevicesRepository } from "@modules/devices/test/in-memory-devices.repository";
import { InMemoryOutboxRepository } from "@modules/messaging/test/in-memory-outbox.repository";
import { FakeWhatsAppGateway } from "@modules/devices/test/fake-whatsapp.gateway";
import { mockAppConfig } from "@test/mocks";
import { Device } from "@modules/devices/domain/entity/device.entity";
import { ConflictError, NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import type { SendRichInput } from "@modules/messaging/application/dto/message.dto";

const ACCOUNT_A = "account-a";
const ACCOUNT_B = "account-b";

// Post-E4, the rich send use case's contract is: validate → write the outbox row
// (type + payload, for the drain to replay by type) → kick the drain when online.
// The physical dispatch is the DRAIN's job (drain-outbox.use-case.spec.ts), so
// the drain is a spy here.
const setup = async () => {
  const devices = new InMemoryDevicesRepository();
  const outbox = new InMemoryOutboxRepository();
  const gateway = new FakeWhatsAppGateway();
  const config = mockAppConfig({ OUTBOX_TTL_HOURS: 24 });
  const drainOutbox = { execute: vi.fn().mockResolvedValue(undefined) };
  const device: Device = await devices.create({
    accountId: ACCOUNT_A,
    name: "d",
    webhookSecret: "s",
  });
  gateway.setConnected(device.id, true);
  const sut = new SendRichMessageUseCase(
    devices,
    outbox,
    gateway,
    config,
    drainOutbox as unknown as DrainOutboxUseCase,
  );
  const imageInput = (
    overrides: Partial<SendRichInput> = {},
  ): SendRichInput => ({
    accountId: ACCOUNT_A,
    deviceId: device.id,
    phone: "5548999999999",
    idempotencyKey: "k1",
    type: "image",
    payload: { image: "https://ex.com/a.png", caption: "hi" },
    ...overrides,
  });
  return { devices, outbox, gateway, device, sut, drainOutbox, imageInput };
};

describe("SendRichMessageUseCase", () => {
  it("writes the row (type + payload), returns 202 PENDING, and kicks the drain when online", async () => {
    const { sut, gateway, outbox, device, drainOutbox, imageInput } =
      await setup();

    const out = await sut.execute(imageInput());

    expect(out.status).toBe("PENDING");
    expect(out.messageId).toBeTruthy();
    // Nothing dispatched inline — the drain replays it by type.
    expect(gateway.sentRich).toHaveLength(0);
    const row = await outbox.findByIdempotencyKey(device.id, "k1");
    expect(row?.type).toBe("image");
    expect(row?.payload).toEqual({
      image: "https://ex.com/a.png",
      caption: "hi",
    });
    expect(row?.text).toBeNull();
    expect(row?.toJid).toBe("5548999999999@s.whatsapp.net");
    expect(drainOutbox.execute).toHaveBeenCalledTimes(1);
    expect(drainOutbox.execute).toHaveBeenCalledWith({ deviceId: device.id });
  });

  it.each([
    ["image", { image: "https://ex.com/a.png" }],
    ["audio", { audio: "https://ex.com/a.ogg" }],
    ["video", { video: "https://ex.com/a.mp4", caption: "c" }],
    ["document", { document: "https://ex.com/a.pdf", fileName: "a.pdf" }],
  ] as const)(
    "stores %s type + payload in the outbox row for the drain to dispatch",
    async (type, payload) => {
      const { sut, outbox, device, imageInput } = await setup();

      await sut.execute(imageInput({ type, payload }));

      const row = await outbox.findByIdempotencyKey(device.id, "k1");
      expect(row?.type).toBe(type);
      expect(row?.payload).toEqual(payload);
    },
  );

  it("queues (202) with type + payload and does NOT kick the drain when offline", async () => {
    const { sut, gateway, outbox, device, drainOutbox, imageInput } =
      await setup();
    gateway.setConnected(device.id, false);

    const out = await sut.execute(imageInput());

    expect(out.status).toBe("PENDING");
    expect(gateway.sentRich).toHaveLength(0);
    const row = await outbox.findByIdempotencyKey(device.id, "k1");
    expect(row?.status).toBe("PENDING");
    expect(row?.type).toBe("image");
    expect(row?.payload).toEqual({
      image: "https://ex.com/a.png",
      caption: "hi",
    });
    expect(row?.text).toBeNull();
    expect(row?.toJid).toBe("5548999999999@s.whatsapp.net");
    // Offline uses buildUserJid — it must NOT hit WhatsApp to resolve the number.
    expect(gateway.resolveCalls).toBe(0);
    // Offline: the reconnect drain sends it — no kick now.
    expect(drainOutbox.execute).not.toHaveBeenCalled();
  });

  it("replays the original on same key + identical payload (order-independent), no second kick", async () => {
    const { sut, drainOutbox, imageInput } = await setup();
    const first = await sut.execute(
      imageInput({ payload: { image: "u", caption: "c" } }),
    );
    // Same content, keys in a different order → still idempotent.
    const second = await sut.execute(
      imageInput({ payload: { caption: "c", image: "u" } }),
    );
    expect(second.messageId).toBe(first.messageId);
    expect(second.status).toBe("PENDING");
    expect(drainOutbox.execute).toHaveBeenCalledTimes(1);
  });

  it("throws IDEMPOTENCY_KEY_CONFLICT on same key + different payload", async () => {
    const { sut, imageInput } = await setup();
    await sut.execute(imageInput({ payload: { image: "u1" } }));

    const promise = sut.execute(imageInput({ payload: { image: "u2" } }));
    await expect(promise).rejects.toBeInstanceOf(ConflictError);
    await expect(promise).rejects.toMatchObject({
      code: ErrorCodes.IDEMPOTENCY_KEY_CONFLICT,
    });
  });

  it("throws IDEMPOTENCY_KEY_CONFLICT on same key + different type", async () => {
    const { sut, imageInput } = await setup();
    await sut.execute(imageInput({ type: "image", payload: { image: "u" } }));

    const promise = sut.execute(
      imageInput({ type: "video", payload: { video: "u" } }),
    );
    await expect(promise).rejects.toMatchObject({
      code: ErrorCodes.IDEMPOTENCY_KEY_CONFLICT,
    });
  });

  it("throws DEVICE_NOT_FOUND for an unknown device", async () => {
    const { sut, imageInput } = await setup();
    await expect(
      sut.execute(imageInput({ deviceId: "nope" })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws DEVICE_NOT_FOUND for a device owned by another account (R3)", async () => {
    const { sut, imageInput } = await setup();
    await expect(
      sut.execute(imageInput({ accountId: ACCOUNT_B })),
    ).rejects.toMatchObject({ code: ErrorCodes.DEVICE_NOT_FOUND });
  });

  it("throws NUMBER_NOT_ON_WHATSAPP when resolveJid returns null (no row, no kick)", async () => {
    const { sut, gateway, outbox, device, drainOutbox, imageInput } =
      await setup();
    gateway.setJid("000", null);

    await expect(
      sut.execute(imageInput({ phone: "000" })),
    ).rejects.toMatchObject({ code: ErrorCodes.NUMBER_NOT_ON_WHATSAPP });
    expect(await outbox.findByIdempotencyKey(device.id, "k1")).toBeNull();
    expect(drainOutbox.execute).not.toHaveBeenCalled();
  });
});
