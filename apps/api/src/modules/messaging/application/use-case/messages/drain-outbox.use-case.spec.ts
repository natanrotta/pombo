import { DrainOutboxUseCase } from "./drain-outbox.use-case";
import { InMemoryOutboxRepository } from "@modules/messaging/test/in-memory-outbox.repository";
import { FakeWhatsAppGateway } from "@modules/devices/test/fake-whatsapp.gateway";
import { TokenBucketSendRateLimiter } from "@modules/messaging/infrastructure/provider/token-bucket-send-rate-limiter";
import type { ISendRateLimiter } from "@modules/messaging/domain/provider/send-rate-limiter.interface";
import type { ISendPacer } from "@modules/messaging/domain/provider/send-pacer.interface";
import {
  mockAppConfig,
  mockLoggerProvider,
  mockSendPacer,
  mockSendRateLimiter,
} from "@test/mocks";
import type {
  DomainEvent,
  IDomainEventBus,
} from "@shared/provider/domain-event-bus.interface";

const DEVICE = "device-1";

class RecordingBus implements IDomainEventBus {
  public published: DomainEvent[] = [];
  publish(event: DomainEvent): void {
    this.published.push(event);
  }
  subscribe(): void {}
}

const future = (): Date => new Date(Date.now() + 60 * 60 * 1000);

const setup = (
  rateLimiter: ISendRateLimiter = mockSendRateLimiter(),
  opts: { pacer?: ISendPacer; humanPacingEnabled?: boolean } = {},
) => {
  const outbox = new InMemoryOutboxRepository();
  const gateway = new FakeWhatsAppGateway();
  const bus = new RecordingBus();
  gateway.setConnected(DEVICE, true);
  const pacer = opts.pacer ?? mockSendPacer();
  const config = mockAppConfig({
    HUMAN_PACING_ENABLED: opts.humanPacingEnabled ?? false,
  });
  const sut = new DrainOutboxUseCase(
    outbox,
    gateway,
    bus,
    rateLimiter,
    mockLoggerProvider(),
    pacer,
    config,
  );
  const enqueue = (
    idempotencyKey: string,
    toJid: string,
    expiresAt = future(),
    rich?: { type: "image"; payload: unknown },
  ) =>
    outbox.create({
      deviceId: DEVICE,
      idempotencyKey,
      toJid,
      ...(rich
        ? { type: rich.type, payload: rich.payload }
        : { text: `t-${idempotencyKey}` }),
      expiresAt,
    });
  return { outbox, gateway, bus, sut, enqueue, pacer };
};

describe("DrainOutboxUseCase", () => {
  it("sends every queued message, stamps it, and publishes message.sent", async () => {
    const { sut, outbox, gateway, bus, enqueue } = setup();
    const a = await enqueue("a", "5511@s.whatsapp.net");
    const b = await enqueue("b", "5522@s.whatsapp.net");

    await sut.execute({ deviceId: DEVICE });

    expect(gateway.sentTexts.map((s) => s.jid)).toEqual([
      "5511@s.whatsapp.net",
      "5522@s.whatsapp.net",
    ]);
    // Both rows now carry a waMessageId (sent).
    expect((await outbox.findById(a.id))?.waMessageId).toBeTruthy();
    expect((await outbox.findById(b.id))?.waMessageId).toBeTruthy();
    // message.sent published per drained message, phone recovered from the jid.
    const sent = bus.published.filter((e) => e.type === "message.sent");
    expect(sent).toHaveLength(2);
    expect(sent).toContainEqual({
      type: "message.sent",
      deviceId: DEVICE,
      messageId: a.id,
      phone: "5511",
    });
  });

  it("publishes message.sent with the FULL group JID (not stripped) for a drained group message", async () => {
    const { sut, bus, enqueue } = setup();
    const groupJid = "120363000000000001@g.us";
    const g = await enqueue("g", groupJid);

    await sut.execute({ deviceId: DEVICE });

    // A group JID is not a phone — it must ride the event as-is, matching the
    // live send path (regression guard for the drain's userJidToPhone default).
    expect(bus.published).toContainEqual({
      type: "message.sent",
      deviceId: DEVICE,
      messageId: g.id,
      phone: groupJid,
    });
  });

  it("drains a queued non-text row via the type-matched gateway method (AC-6)", async () => {
    const { sut, gateway, enqueue } = setup();
    await enqueue("img", "5511@s.whatsapp.net", future(), {
      type: "image",
      payload: { image: "https://ex.com/a.png" },
    });

    await sut.execute({ deviceId: DEVICE });

    // Replayed as an image — never re-sent as text.
    expect(gateway.sentTexts).toHaveLength(0);
    expect(gateway.sentRich).toEqual([
      {
        deviceId: DEVICE,
        jid: "5511@s.whatsapp.net",
        type: "image",
        payload: { image: "https://ex.com/a.png" },
      },
    ]);
  });

  it("stops draining the moment the device drops again", async () => {
    const { sut, outbox, gateway, enqueue } = setup();
    await enqueue("a", "5511@s.whatsapp.net");
    const b = await enqueue("b", "5522@s.whatsapp.net");
    // The first send drops the device → the loop must break before the second.
    gateway.sendText = async (deviceId, jid, text) => {
      gateway.sentTexts.push({ deviceId, jid, text });
      gateway.setConnected(deviceId, false);
      return { waMessageId: "wa-1" };
    };

    await sut.execute({ deviceId: DEVICE });

    expect(gateway.sentTexts).toHaveLength(1);
    // b was never sent — still queued for the next reconnect.
    expect((await outbox.findById(b.id))?.waMessageId).toBeNull();
    expect((await outbox.findById(b.id))?.status).toBe("PENDING");
  });

  it("does not send expired queued messages", async () => {
    const { sut, gateway, enqueue } = setup();
    await enqueue("old", "5511@s.whatsapp.net", new Date(Date.now() - 1000));

    await sut.execute({ deviceId: DEVICE });

    expect(gateway.sentTexts).toHaveLength(0);
  });

  it("marks a message FAILED when the send fails while still connected", async () => {
    const { sut, outbox, gateway, enqueue } = setup();
    const a = await enqueue("a", "5511@s.whatsapp.net");
    gateway.sendText = async () => {
      throw new Error("bad number");
    };

    await sut.execute({ deviceId: DEVICE });

    expect((await outbox.findById(a.id))?.status).toBe("FAILED");
  });

  it("moves the row to SERVER_ACK (not FAILED, not re-sent) when only the stamp fails after delivery", async () => {
    const { sut, outbox, gateway, bus, enqueue } = setup();
    const a = await enqueue("a", "5511@s.whatsapp.net");
    outbox.setWaMessageId = async () => {
      throw new Error("stamp db down");
    };

    await sut.execute({ deviceId: DEVICE });

    // Delivered (message.sent fired), NOT FAILED, and out of the queue so the
    // next reconnect can't re-send it.
    expect(gateway.sentTexts).toHaveLength(1);
    expect(bus.published.filter((e) => e.type === "message.sent")).toHaveLength(
      1,
    );
    expect((await outbox.findById(a.id))?.status).toBe("SERVER_ACK");
    expect(await outbox.findQueued(DEVICE, 100)).toHaveLength(0);
  });

  it("paces the drain on the rate limiter — sends the whole queue FIFO despite a tight budget", async () => {
    // Capacity 1, refills 1 token / 10ms: the first send exhausts the budget,
    // so the drain must WAIT for the refill before the second — and still send
    // both, in order. Uses a real limiter + real (tiny) waits.
    const { sut, gateway, enqueue } = setup(
      new TokenBucketSendRateLimiter(1, 10),
    );
    await enqueue("a", "5511@s.whatsapp.net");
    await enqueue("b", "5522@s.whatsapp.net");

    await sut.execute({ deviceId: DEVICE });

    expect(gateway.sentTexts.map((s) => s.jid)).toEqual([
      "5511@s.whatsapp.net",
      "5522@s.whatsapp.net",
    ]);
  });

  it("is single-flight per device (a concurrent drain is a no-op)", async () => {
    const { sut, gateway, enqueue } = setup();
    await enqueue("a", "5511@s.whatsapp.net");
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let calls = 0;
    gateway.sendText = async () => {
      calls += 1;
      await gate;
      return { waMessageId: `wa-${calls}` };
    };

    const first = sut.execute({ deviceId: DEVICE });
    const second = sut.execute({ deviceId: DEVICE }); // guarded → no-op
    release();
    await Promise.all([first, second]);

    expect(calls).toBe(1);
  });

  it("re-checks the queue when a kick arrives mid-drain (no lost wakeup)", async () => {
    const { sut, gateway, enqueue } = setup();
    await enqueue("a", "5511@s.whatsapp.net");
    let firstSend = true;
    const realSendText = gateway.sendText.bind(gateway);
    gateway.sendText = async (d, j, t) => {
      if (firstSend) {
        firstSend = false;
        // While A is being sent, enqueue B and fire a concurrent kick. The kick
        // is collapsed by the single-flight guard — it MUST arm the re-run so the
        // running drain re-queries and sends B, not leave it stuck.
        await enqueue("b", "5522@s.whatsapp.net");
        void sut.execute({ deviceId: DEVICE });
      }
      return realSendText(d, j, t);
    };

    await sut.execute({ deviceId: DEVICE });

    // Without the re-arm, B (enqueued after the drain's findQueued) would sit
    // unsent — only A would appear here.
    expect(gateway.sentTexts.map((s) => s.jid)).toEqual([
      "5511@s.whatsapp.net",
      "5522@s.whatsapp.net",
    ]);
  });

  it("no-ops when nothing is queued", async () => {
    const { sut, gateway } = setup();
    await sut.execute({ deviceId: DEVICE });
    expect(gateway.sentTexts).toHaveLength(0);
  });

  // ── Human pacing (E3) ──────────────────────────────────────────────────────

  it("shows typing before sending when human pacing is enabled", async () => {
    const { sut, gateway, pacer, enqueue } = setup(mockSendRateLimiter(), {
      humanPacingEnabled: true,
    });
    await enqueue("a", "5511@s.whatsapp.net");

    await sut.execute({ deviceId: DEVICE });

    // Composing raised for the target jid, typing duration derived from the text
    // length ("t-a" → 3), and the message still went out.
    expect(gateway.typingCalls).toContainEqual({
      deviceId: DEVICE,
      jid: "5511@s.whatsapp.net",
      on: true,
    });
    // Exactly one composing per message — a duplicate indicator is observable.
    expect(gateway.typingCalls.filter((c) => c.on)).toHaveLength(1);
    // …and it precedes the send (a reorder would leave the above green).
    expect(gateway.callLog).toEqual(["typing", "text"]);
    expect(pacer.typingDelayMs).toHaveBeenCalledWith(3);
    expect(gateway.sentTexts).toHaveLength(1);
  });

  it("does NOT show typing when human pacing is disabled (default)", async () => {
    const { sut, gateway, pacer, enqueue } = setup(); // flag off
    await enqueue("a", "5511@s.whatsapp.net");

    await sut.execute({ deviceId: DEVICE });

    expect(gateway.typingCalls).toHaveLength(0);
    expect(pacer.typingDelayMs).not.toHaveBeenCalled();
    expect(gateway.sentTexts).toHaveLength(1);
  });

  it("rolls a long pause BETWEEN messages, but not after the last in the batch (D12)", async () => {
    const { sut, gateway, pacer, enqueue } = setup(mockSendRateLimiter(), {
      humanPacingEnabled: true,
    });
    await enqueue("a", "5511@s.whatsapp.net");
    await enqueue("b", "5522@s.whatsapp.net");

    await sut.execute({ deviceId: DEVICE });

    // 2 messages, 1 batch: the pause is rolled after the 1st (an inter-message
    // gap) but skipped after the 2nd/last — so exactly one roll (returns 0 anyway).
    expect(pacer.longPauseMs).toHaveBeenCalledTimes(1);
    // Typing still runs for BOTH messages (paceTyping is per-message), and each
    // composing precedes its send — asserted via the ordered call log.
    expect(gateway.typingCalls.filter((c) => c.on)).toHaveLength(2);
    expect(gateway.callLog).toEqual(["typing", "text", "typing", "text"]);
  });
});
