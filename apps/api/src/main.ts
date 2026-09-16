import "reflect-metadata";
import "@core/container";
import { errorReporter, initErrorReporter } from "@core/service/error-reporter";

initErrorReporter();

import http from "node:http";
import { app } from "@core/http";
import { logger } from "@core/http/logger";
import { env } from "@core/config";
import { container } from "@core/container";
import { startWhatsAppGateway } from "@core/service/whatsapp/gateway-boot";
import {
  buildShutdownPlan,
  installGracefulShutdown,
} from "@core/service/lifecycle";

const server = http.createServer(app);

// Set once the gateway is up (WHATSAPP_ENABLED=true only); the teardown step
// is a no-op until then — and forever when the gateway is disabled.
let stopWhatsAppGateway: (() => Promise<void>) | null = null;

// Installed BEFORE boot so a crash during startup still tears down cleanly.
installGracefulShutdown({
  logger,
  timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  report: (error) => errorReporter.notify(error),
  plan: buildShutdownPlan({
    container,
    server,
    stopWhatsAppGateway: () => stopWhatsAppGateway?.() ?? Promise.resolve(),
  }),
});

const start = async (): Promise<void> => {
  // Acquires the single-replica advisory lock, wires the bus listeners,
  // rehydrates CONNECTED devices and starts the outbox prune. When disabled,
  // Baileys is never even imported — every HTTP endpoint still responds.
  if (env.WHATSAPP_ENABLED) {
    stopWhatsAppGateway = await startWhatsAppGateway();
  }

  server.listen(env.API_PORT, () => {
    logger.info(
      {
        port: env.API_PORT,
        environment: env.NODE_ENV,
        whatsappEnabled: env.WHATSAPP_ENABLED,
      },
      "Server started",
    );
  });
};

void start();
