import { CountQueuedMessagesUseCase } from "./count-queued-messages.use-case";
import { InMemoryOutboxRepository } from "@modules/messaging/test/in-memory-outbox.repository";

const ACCOUNT_A = "account-a";
const ACCOUNT_B = "account-b";
const DEVICE_A = "device-a";
const DEVICE_B = "device-b";

const ALIVE = () => new Date(Date.now() + 60_000);

async function setup() {
  const outbox = new InMemoryOutboxRepository();
  outbox.linkDevice(DEVICE_A, ACCOUNT_A);
  outbox.linkDevice(DEVICE_B, ACCOUNT_B);
  return { outbox, sut: new CountQueuedMessagesUseCase(outbox) };
}

async function queue(
  outbox: InMemoryOutboxRepository,
  deviceId: string,
  key: string,
  expiresAt = ALIVE(),
) {
  return outbox.create({
    deviceId,
    idempotencyKey: key,
    toJid: "5599@s.whatsapp.net",
    text: "oi",
    expiresAt,
  });
}

describe("CountQueuedMessagesUseCase", () => {
  it("counts nothing for an account with no queued message", async () => {
    const { sut } = await setup();

    await expect(sut.execute(ACCOUNT_A)).resolves.toEqual({ pending: 0 });
  });

  it("counts every pending message across the account's devices", async () => {
    const { outbox, sut } = await setup();
    outbox.linkDevice("device-a2", ACCOUNT_A);
    await queue(outbox, DEVICE_A, "k-1");
    await queue(outbox, DEVICE_A, "k-2");
    await queue(outbox, "device-a2", "k-3");

    await expect(sut.execute(ACCOUNT_A)).resolves.toEqual({ pending: 3 });
  });

  it("never counts another account's queue (R1)", async () => {
    const { outbox, sut } = await setup();
    await queue(outbox, DEVICE_B, "k-1");
    await queue(outbox, DEVICE_B, "k-2");

    await expect(sut.execute(ACCOUNT_A)).resolves.toEqual({ pending: 0 });
    await expect(sut.execute(ACCOUNT_B)).resolves.toEqual({ pending: 2 });
  });

  it("stops counting a message once it reached WhatsApp", async () => {
    const { outbox, sut } = await setup();
    const handed = await queue(outbox, DEVICE_A, "k-1");
    await queue(outbox, DEVICE_A, "k-2");

    await outbox.setWaMessageId(handed.id, "wa-1");

    await expect(sut.execute(ACCOUNT_A)).resolves.toEqual({ pending: 1 });
  });

  it("ignores a message whose TTL already passed", async () => {
    const { outbox, sut } = await setup();
    await queue(outbox, DEVICE_A, "k-1", new Date(Date.now() - 1_000));

    await expect(sut.execute(ACCOUNT_A)).resolves.toEqual({ pending: 0 });
  });

  it("ignores a message that already left the queue", async () => {
    const { outbox, sut } = await setup();
    const sent = await queue(outbox, DEVICE_A, "k-1");

    await outbox.updateStatus(sent.id, "SERVER_ACK");

    await expect(sut.execute(ACCOUNT_A)).resolves.toEqual({ pending: 0 });
  });
});
