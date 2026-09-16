import "reflect-metadata";
import { container } from "tsyringe";
import { env } from "@core/config";
import { DI_TOKENS } from "./tokens";

import { registerUserModule } from "@modules/user/user.module";
import { registerAuthModule } from "@modules/auth/auth.module";
import { registerAccountModule } from "@modules/account/account.module";
import { registerDevicesModule } from "@modules/devices/devices.module";
import { registerMessagingModule } from "@modules/messaging/messaging.module";
import { registerWebhooksModule } from "@modules/webhooks/webhooks.module";
import { IMailProvider } from "@shared/provider/mail-provider.interface";
import { ConsoleMailProvider } from "@core/provider/mail/console-mail-provider";
import { ResendMailProvider } from "@core/provider/mail/resend-mail-provider";

import {
  AppConfig,
  ICacheProvider,
  IHashProvider,
  IJwtProvider,
  ILoggerProvider,
  IStorageProvider,
  IQueueProvider,
  IEventBus,
  IDomainEventBus,
  IFlowProducer,
  IDatabaseStatusProvider,
  INodeExporterMetricsProvider,
  ICiProvider,
} from "@shared/provider";
import { InMemoryDomainEventBus } from "@core/provider/domain-event-bus/in-memory-domain-event-bus";
import { IWhatsAppGateway } from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import { DisabledWhatsAppGateway } from "@modules/devices/infrastructure/provider/disabled-whatsapp.gateway";
import { BaileysWhatsAppGateway } from "@modules/devices/infrastructure/provider/baileys-whatsapp.gateway";
import { IOutboxRepository } from "@modules/messaging/domain/repository/outbox-repository.interface";

import {
  BcryptHashProvider,
  RedisCacheProvider,
  JsonWebTokenJwtProvider,
} from "@core/provider";
import { S3StorageProvider } from "@core/provider/storage/s3-storage-provider";
import { BullMQQueueProvider } from "@core/provider/queue/bullmq-queue-provider";
import { PrismaDatabaseStatusProvider } from "@core/database/prisma/prisma-database-status-provider";
import { NodeExporterMetricsProvider } from "@core/provider/metrics/node-exporter-metrics.provider";
import { GitHubActionsCiProvider } from "@core/provider/ci/github-actions-ci.provider";
import { BullMQFlowProducer } from "@core/provider/queue/bullmq-flow-producer";
import { RedisEventBus } from "@core/provider/event-bus/redis-event-bus";
import { PinoLoggerProvider } from "@core/provider/logger/pino-logger-provider";

// ── Modules ──
registerUserModule(container);
registerAuthModule(container);
registerAccountModule(container);
registerDevicesModule(container);
registerMessagingModule(container);
registerWebhooksModule(container);

// ── Providers ──
container.registerSingleton<ICacheProvider>(
  DI_TOKENS.CacheProvider,
  RedisCacheProvider,
);
container.registerSingleton<IDatabaseStatusProvider>(
  DI_TOKENS.DatabaseStatusProvider,
  PrismaDatabaseStatusProvider,
);
container.registerSingleton<INodeExporterMetricsProvider>(
  DI_TOKENS.NodeExporterMetricsProvider,
  NodeExporterMetricsProvider,
);
container.registerSingleton<ICiProvider>(
  DI_TOKENS.CiProvider,
  GitHubActionsCiProvider,
);
container.registerSingleton<IHashProvider>(
  DI_TOKENS.HashProvider,
  BcryptHashProvider,
);
container.registerSingleton<IJwtProvider>(
  DI_TOKENS.JwtProvider,
  JsonWebTokenJwtProvider,
);
container.registerSingleton<IStorageProvider>(
  DI_TOKENS.StorageProvider,
  S3StorageProvider,
);
container.registerSingleton<IQueueProvider>(
  DI_TOKENS.QueueProvider,
  BullMQQueueProvider,
);
container.registerSingleton<IFlowProducer>(
  DI_TOKENS.FlowProducer,
  BullMQFlowProducer,
);
container.registerSingleton<IEventBus>(DI_TOKENS.EventBus, RedisEventBus);
container.registerSingleton<ILoggerProvider>(
  DI_TOKENS.LoggerProvider,
  PinoLoggerProvider,
);

// ── WhatsApp Gateway (pombo) providers ──
// The typed in-process domain event bus (session + message-status vocabulary).
// Distinct from the Redis `EventBus` used for SSE.
container.registerSingleton<IDomainEventBus>(
  DI_TOKENS.DomainEventBus,
  InMemoryDomainEventBus,
);

// The WhatsApp gateway is gated by WHATSAPP_ENABLED. When disabled (default),
// bind the no-op gateway — it never imports Baileys and never opens a socket, so
// the app boots and every HTTP endpoint responds; `connect` returns a clean
// WA_GATEWAY_DISABLED. When enabled, bind the Baileys impl (which dynamically
// imports Baileys only on first use).
if (env.WHATSAPP_ENABLED) {
  container.registerSingleton<IWhatsAppGateway>(
    DI_TOKENS.WhatsAppGateway,
    BaileysWhatsAppGateway,
  );
} else {
  container.registerSingleton<IWhatsAppGateway>(
    DI_TOKENS.WhatsAppGateway,
    DisabledWhatsAppGateway,
  );
}

// getMessage (a resend) resolves an outbox row's original text from a
// waMessageId — injected as a plain function so `devices` never imports
// `messaging` (no circular dependency). Resolved lazily from the container.
container.register<(waMessageId: string) => Promise<string | null>>(
  DI_TOKENS.ResolveOutboxText,
  {
    useValue: async (waMessageId: string): Promise<string | null> => {
      const outbox = container.resolve<IOutboxRepository>(
        DI_TOKENS.OutboxRepository,
      );
      const message = await outbox.findByWaMessageId(waMessageId);
      return message?.text ?? null;
    },
  },
);

// Use Resend when an API key is configured; fall back to the console provider
// in local/dev. ConsoleMailProvider throws in production as a safety net.
container.registerSingleton<IMailProvider>(
  DI_TOKENS.MailProvider,
  env.RESEND_API_KEY ? ResendMailProvider : ConsoleMailProvider,
);

// ── Config values ──
// The parsed env structurally satisfies the AppConfig domain port. The
// container is the composition root — the one place allowed to bridge the
// infrastructure config into application-layer consumers (R8 / B-C10).
container.register<AppConfig>(DI_TOKENS.AppConfig, { useValue: env });
container.register(DI_TOKENS.GoogleClientId, {
  useValue: env.GOOGLE_CLIENT_ID ?? "",
});
container.register(DI_TOKENS.FrontendUrl, { useValue: env.FRONTEND_URL });
container.register(DI_TOKENS.ApiVersion, {
  useValue: env.APP_VERSION ?? env.GIT_COMMIT ?? env.COMMIT_SHA ?? "unknown",
});
container.register(DI_TOKENS.ApiEnv, { useValue: env.NODE_ENV });

export { container };
export { DI_TOKENS } from "./tokens";
export type { DiToken } from "./tokens";
