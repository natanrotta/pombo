import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import {
  IWebhookSender,
  WebhookDelivery,
} from "@modules/webhooks/domain/provider/webhook-sender.interface";
import type { ILoggerProvider } from "@shared/provider/logger-provider.interface";
import { AppConfig } from "@shared/provider/app-config.interface";
import { assertSafeOutboundUrl } from "@shared/util/ssrf-guard";
import { AppError } from "@shared/error";
import { signWebhook } from "./hmac-signer";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });

/**
 * Delivers a signed webhook over HTTP with bounded retries, then gives up.
 * NEVER throws to the caller — best-effort: the authoritative state is always
 * GET /devices, so a lost webhook is logged, not fatal. Retries transient
 * failures (network/timeout, 5xx, 429); does NOT retry a 4xx rejection.
 *
 * SSRF posture (SEC-C6): the URL is customer-supplied. Before EVERY attempt the
 * host is re-resolved and must point only at public addresses
 * (`assertSafeOutboundUrl`) — re-checking per attempt shrinks the DNS-rebinding
 * window to the gap between our lookup and the socket's. Redirects are never
 * followed (`redirect: "manual"`): a 3xx would let the customer bounce us to an
 * internal address after the check, so it is treated as a final rejection.
 */
@injectable()
export class HttpWebhookSender implements IWebhookSender {
  constructor(
    @inject(DI_TOKENS.LoggerProvider)
    private readonly logger: ILoggerProvider,
    @inject(DI_TOKENS.AppConfig)
    private readonly config: AppConfig,
  ) {}

  private async post(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<number> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.WEBHOOK_TIMEOUT_MS,
    );
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
        redirect: "manual",
      });
      return res.status;
    } finally {
      clearTimeout(timer);
    }
  }

  private retriable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  /** A redirect is a rejection: following it would bypass the SSRF guard. */
  private redirected(status: number): boolean {
    return status >= 300 && status < 400;
  }

  async send({ url, secret, event }: WebhookDelivery): Promise<void> {
    // Sign and send the EXACT same bytes. The X-Timestamp header, the signed
    // timestamp, and the body's `timestamp` are the same instant.
    const rawBody = JSON.stringify(event);
    const timestamp = Math.floor(Date.parse(event.timestamp) / 1000);
    const headers = {
      "Content-Type": "application/json",
      "X-Event-Id": event.eventId,
      "X-Signature": signWebhook(rawBody, timestamp, secret),
      "X-Timestamp": String(timestamp),
    };

    const maxAttempts = this.config.WEBHOOK_MAX_ATTEMPTS;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await assertSafeOutboundUrl(url);
      } catch (error) {
        // A blocked target is not transient — never retried, never thrown.
        // Deliberately the same for "host does not resolve": a resolver blip
        // costs this one delivery (the next event re-resolves), whereas
        // retrying around the guard would keep hammering a host the customer
        // pointed at something unresolvable. Fail closed, cheaply.
        this.logger.warn(
          {
            type: event.type,
            deviceId: event.deviceId,
            code: error instanceof AppError ? error.code : "UNKNOWN",
          },
          "webhook target blocked by the outbound-url guard, giving up",
        );
        return;
      }
      try {
        const status = await this.post(url, rawBody, headers);
        if (status >= 200 && status < 300) return; // delivered
        if (this.redirected(status) || !this.retriable(status)) {
          this.logger.warn(
            { type: event.type, deviceId: event.deviceId, status },
            "webhook rejected, giving up",
          );
          return;
        }
        // 5xx / 429 → fall through to backoff + retry
      } catch {
        // network error or timeout (abort) → retry (at-least-once)
      }
      if (attempt < maxAttempts) {
        await delay(
          this.config.WEBHOOK_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
        );
      }
    }

    this.logger.warn(
      { type: event.type, deviceId: event.deviceId, attempts: maxAttempts },
      "webhook delivery failed after retries",
    );
  }
}
