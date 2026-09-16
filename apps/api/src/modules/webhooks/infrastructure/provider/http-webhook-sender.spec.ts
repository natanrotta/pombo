import { HttpWebhookSender } from "./http-webhook-sender";
import { mockAppConfig } from "@test/mocks";
import type { ILoggerProvider } from "@shared/provider/logger-provider.interface";
import { WebhookEvent } from "@modules/webhooks/domain/entity/webhook-event";
import { BadRequestError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

const guardMock = vi.hoisted(() => vi.fn());
vi.mock("@shared/util/ssrf-guard", () => ({
  assertSafeOutboundUrl: guardMock,
}));

const makeLogger = (): ILoggerProvider => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const event: WebhookEvent = {
  type: "device.connected",
  deviceId: "d1",
  data: { identifier: "5599" },
  eventId: "evt_1",
  timestamp: new Date("2025-01-01T00:00:00.000Z").toISOString(),
};

describe("HttpWebhookSender", () => {
  beforeEach(() => {
    guardMock.mockReset();
    guardMock.mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("delivers once on a 2xx and signs the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const sender = new HttpWebhookSender(
      makeLogger(),
      mockAppConfig({ WEBHOOK_MAX_ATTEMPTS: 3 }),
    );

    await sender.send({ url: "http://hook", secret: "s", event });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers["X-Signature"]).toMatch(/^sha256=/);
    expect(init.headers["X-Event-Id"]).toBe("evt_1");
    // Redirects are never followed — a 3xx must not bypass the SSRF guard.
    expect(init.redirect).toBe("manual");
  });

  it("re-checks the target through the SSRF guard before EVERY attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 503 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const sender = new HttpWebhookSender(
      makeLogger(),
      mockAppConfig({
        WEBHOOK_MAX_ATTEMPTS: 3,
        WEBHOOK_RETRY_BASE_DELAY_MS: 0,
      }),
    );

    await sender.send({ url: "http://hook", secret: "s", event });

    expect(guardMock).toHaveBeenCalledTimes(3);
    expect(guardMock).toHaveBeenCalledWith("http://hook");
  });

  it("never fetches a URL the guard blocks, logs the code, and does not retry or throw", async () => {
    guardMock.mockRejectedValue(
      new BadRequestError(
        "blocked",
        undefined,
        ErrorCodes.OUTBOUND_URL_BLOCKED,
      ),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const logger = makeLogger();
    const sender = new HttpWebhookSender(
      logger,
      mockAppConfig({
        WEBHOOK_MAX_ATTEMPTS: 3,
        WEBHOOK_RETRY_BASE_DELAY_MS: 0,
      }),
    );

    await expect(
      sender.send({ url: "http://169.254.169.254/", secret: "s", event }),
    ).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(guardMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.OUTBOUND_URL_BLOCKED }),
      expect.stringContaining("blocked"),
    );
  });

  it("treats a redirect (3xx) as a final rejection — never followed, never retried", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 302 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const sender = new HttpWebhookSender(
      makeLogger(),
      mockAppConfig({
        WEBHOOK_MAX_ATTEMPTS: 3,
        WEBHOOK_RETRY_BASE_DELAY_MS: 0,
      }),
    );

    await sender.send({ url: "http://hook", secret: "s", event });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a 4xx rejection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 400 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const sender = new HttpWebhookSender(
      makeLogger(),
      mockAppConfig({ WEBHOOK_MAX_ATTEMPTS: 3 }),
    );

    await sender.send({ url: "http://hook", secret: "s", event });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx up to maxAttempts then gives up (never throws)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 503 } as Response);
    vi.stubGlobal("fetch", fetchMock);
    const sender = new HttpWebhookSender(
      makeLogger(),
      mockAppConfig({
        WEBHOOK_MAX_ATTEMPTS: 3,
        WEBHOOK_RETRY_BASE_DELAY_MS: 0,
      }),
    );

    await expect(
      sender.send({ url: "http://hook", secret: "s", event }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
