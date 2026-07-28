import { instanceCachingFactory, type DependencyContainer } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import type { AppConfig } from "@shared/provider/app-config.interface";
import { IOutboxRepository } from "@modules/messaging/domain/repository/outbox-repository.interface";
import { PrismaOutboxRepository } from "@modules/messaging/infrastructure/repository/prisma-outbox.repository";
import { ISendRateLimiter } from "@modules/messaging/domain/provider/send-rate-limiter.interface";
import { TokenBucketSendRateLimiter } from "@modules/messaging/infrastructure/provider/token-bucket-send-rate-limiter";
import { ISendPacer } from "@modules/messaging/domain/provider/send-pacer.interface";
import { HumanSendPacer } from "@modules/messaging/infrastructure/provider/human-send-pacer";
import { DrainOutboxUseCase } from "@modules/messaging/application/use-case/messages";

/**
 * DI wiring for the messaging domain (outbox + delivery status + send throttle).
 * Registers the outbox repository; most use cases are `@injectable()` and
 * resolved on demand. Two things MUST be singletons because they hold
 * per-device in-memory state: `DrainOutboxUseCase` (the single-flight guard
 * across events) and the `SendRateLimiter` (the token buckets — shared by the
 * live send and the drain). The `ResolveOutboxText` function (Baileys
 * getMessage) is bound in the container composition root so `devices` never
 * imports `messaging`.
 */
export function registerMessagingModule(container: DependencyContainer): void {
  container.registerSingleton<IOutboxRepository>(
    DI_TOKENS.OutboxRepository,
    PrismaOutboxRepository,
  );
  // instanceCachingFactory → constructed once and cached (singleton), lazily so
  // it doesn't depend on AppConfig being registered before this module.
  container.register<ISendRateLimiter>(DI_TOKENS.SendRateLimiter, {
    useFactory: instanceCachingFactory((c) => {
      const config = c.resolve<AppConfig>(DI_TOKENS.AppConfig);
      return new TokenBucketSendRateLimiter(
        config.SEND_RATE_MAX,
        config.SEND_RATE_WINDOW_MS,
      );
    }),
  });
  // The human send pacer (typing/jitter rhythm under the rate-limit ceiling).
  // Stateless — cached only for cheapness, not for correctness. Consumed by the
  // outbox drain (DrainOutboxUseCase) when HUMAN_PACING_ENABLED is on.
  container.register<ISendPacer>(DI_TOKENS.SendPacer, {
    useFactory: instanceCachingFactory((c) => {
      const config = c.resolve<AppConfig>(DI_TOKENS.AppConfig);
      return new HumanSendPacer(
        config.TYPING_MS_PER_CHAR,
        config.TYPING_MIN_MS,
        config.TYPING_MAX_MS,
        config.SEND_JITTER_PCT,
        config.LONG_PAUSE_PROBABILITY,
        config.LONG_PAUSE_MIN_MS,
        config.LONG_PAUSE_MAX_MS,
      );
    }),
  });
  container.registerSingleton(DrainOutboxUseCase);
}
