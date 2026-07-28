import { SendTextMessageUseCase } from "./send-text-message.use-case";
import type { DrainOutboxUseCase } from "./drain-outbox.use-case";
import { InMemoryDevicesRepository } from "@modules/devices/test/in-memory-devices.repository";
import { InMemoryOutboxRepository } from "@modules/messaging/test/in-memory-outbox.repository";
import { FakeWhatsAppGateway } from "@modules/devices/test/fake-whatsapp.gateway";
import { mockAppConfig } from "@test/mocks";
import { Device } from "@modules/devices/domain/entity/device.entity";
import { ConflictError, NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

const ACCOUNT_A = "account-a";
const ACCOUNT_B = "account-b";

// Post-E4, the send use case's contract is: validate → write the outbox row →
// kick the drain when online. The physical, paced/humanized send is the DRAIN's
// job (tested in drain-outbox.use-case.spec.ts), so here the drain is a spy: we
// assert the use case hands off correctly, not what the drain does with it.
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
  const sut = new SendTextMessageUseCase(
    devices,
    outbox,
    gateway,
    config,
    drainOutbox as unknown as DrainOutboxUseCase,
  );
  return { devices, outbox, gateway, device, sut, drainOutbox };
};

describe("SendTextMessageUseCase", () => {
  it("writes the outbox row, returns 202 PENDING, and kicks the drain when online", async () => {
    const { sut, device, gateway, outbox, drainOutbox } = await setup();

    const out = await sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      phone: "5548999999999",
      text: "oi",
      idempotencyKey: "k1",
    });

    expect(out.status).toBe("PENDING");
    expect(out.messageId).toBeTruthy();
    // Nothing sent inline — the drain owns the physical send now.
    expect(gateway.sentTexts).toHaveLength(0);
    const row = await outbox.findByIdempotencyKey(device.id, "k1");
    expect(row?.status).toBe("PENDING");
    // The resolved jid is stored for the drain to send.
    expect(row?.toJid).toBe("5548999999999@s.whatsapp.net");
    expect(drainOutbox.execute).toHaveBeenCalledTimes(1);
    expect(drainOutbox.execute).toHaveBeenCalledWith({ deviceId: device.id });
  });

  it("queues (202) with the constructed jid and does NOT kick the drain when offline", async () => {
    const { sut, device, gateway, outbox, drainOutbox } = await setup();
    gateway.setConnected(device.id, false);

    const out = await sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      phone: "5548999999999",
      text: "oi",
      idempotencyKey: "k",
    });

    expect(out.status).toBe("PENDING");
    expect(gateway.sentTexts).toHaveLength(0);
    const row = await outbox.findByIdempotencyKey(device.id, "k");
    expect(row?.status).toBe("PENDING");
    expect(row?.waMessageId).toBeNull();
    // The constructed jid is stored so the reconnect drain can send it.
    expect(row?.toJid).toBe("5548999999999@s.whatsapp.net");
    // Offline uses buildUserJid — it must NOT hit WhatsApp to resolve the number.
    expect(gateway.resolveCalls).toBe(0);
    // Offline: the `session.connected` reconnect drain sends it — no kick now.
    expect(drainOutbox.execute).not.toHaveBeenCalled();
  });

  it("throws DEVICE_NOT_FOUND for an unknown device", async () => {
    const { sut } = await setup();
    await expect(
      sut.execute({
        accountId: ACCOUNT_A,
        deviceId: "nope",
        phone: "5548",
        text: "oi",
        idempotencyKey: "k",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws DEVICE_NOT_FOUND for a device owned by another account (R3)", async () => {
    const { sut, device } = await setup();
    await expect(
      sut.execute({
        accountId: ACCOUNT_B,
        deviceId: device.id,
        phone: "5548",
        text: "oi",
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.DEVICE_NOT_FOUND });
  });

  it("replays the original on same key + same text and does not kick the drain again", async () => {
    const { sut, device, drainOutbox } = await setup();
    const first = await sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      phone: "5548",
      text: "oi",
      idempotencyKey: "k",
    });
    const second = await sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      phone: "5548",
      text: "oi",
      idempotencyKey: "k",
    });

    expect(second.messageId).toBe(first.messageId);
    expect(second.status).toBe("PENDING");
    // Only the first send kicked the drain; the replay returns before the kick.
    expect(drainOutbox.execute).toHaveBeenCalledTimes(1);
  });

  it("throws IDEMPOTENCY_KEY_CONFLICT on same key + different text", async () => {
    const { sut, device } = await setup();
    await sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      phone: "5548",
      text: "oi",
      idempotencyKey: "k",
    });

    const promise = sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      phone: "5548",
      text: "MUDOU",
      idempotencyKey: "k",
    });
    await expect(promise).rejects.toBeInstanceOf(ConflictError);
    await expect(promise).rejects.toMatchObject({
      code: ErrorCodes.IDEMPOTENCY_KEY_CONFLICT,
    });
  });

  it("throws NUMBER_NOT_ON_WHATSAPP when resolveJid returns null (no row, no kick)", async () => {
    const { sut, device, gateway, outbox, drainOutbox } = await setup();
    gateway.setJid("000", null);

    const promise = sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      phone: "000",
      text: "oi",
      idempotencyKey: "k",
    });
    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toMatchObject({
      code: ErrorCodes.NUMBER_NOT_ON_WHATSAPP,
    });
    // Validation failed before any write — no row, drain untouched.
    expect(await outbox.findByIdempotencyKey(device.id, "k")).toBeNull();
    expect(drainOutbox.execute).not.toHaveBeenCalled();
  });

  // ── Group send (reuses this use case with a group JID) ──────────────────────

  it("stores a group send with the group JID, skips resolveJid, and kicks the drain", async () => {
    const { sut, device, gateway, outbox, drainOutbox } = await setup();
    const groupJid = "120363000000000001@g.us";

    const out = await sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      groupJid,
      text: "oi grupo",
      idempotencyKey: "g1",
    });

    expect(out.status).toBe("PENDING");
    // Group JIDs are canonical — the user-only onWhatsApp lookup must be skipped.
    expect(gateway.resolveCalls).toBe(0);
    // Nothing sent inline; the drain delivers it (and then publishes message.sent
    // with the group JID as recipient — see drain-outbox.use-case.spec.ts).
    expect(gateway.sentTexts).toHaveLength(0);
    const row = await outbox.findByIdempotencyKey(device.id, "g1");
    expect(row?.toJid).toBe(groupJid);
    expect(drainOutbox.execute).toHaveBeenCalledWith({ deviceId: device.id });
  });

  it("replays a group send on same key + same text (idempotent), no second kick", async () => {
    const { sut, device, drainOutbox } = await setup();
    const first = {
      accountId: ACCOUNT_A,
      deviceId: device.id,
      groupJid: "120363000000000001@g.us",
      text: "oi grupo",
      idempotencyKey: "gk",
    };
    const a = await sut.execute(first);
    const b = await sut.execute(first);

    expect(b.messageId).toBe(a.messageId);
    // The idempotency gate runs before the kick → only the first kicked the drain.
    expect(drainOutbox.execute).toHaveBeenCalledTimes(1);
  });

  it("queues a group send (202 PENDING) with the group JID and no kick when offline", async () => {
    const { sut, device, gateway, outbox, drainOutbox } = await setup();
    gateway.setConnected(device.id, false);
    const groupJid = "120363000000000001@g.us";

    const out = await sut.execute({
      accountId: ACCOUNT_A,
      deviceId: device.id,
      groupJid,
      text: "oi",
      idempotencyKey: "g-off",
    });

    expect(out.status).toBe("PENDING");
    expect(gateway.sentTexts).toHaveLength(0);
    const row = await outbox.findByIdempotencyKey(device.id, "g-off");
    expect(row?.status).toBe("PENDING");
    expect(row?.toJid).toBe(groupJid);
    // Offline: the reconnect drain sends it — no kick now.
    expect(drainOutbox.execute).not.toHaveBeenCalled();
  });
});
