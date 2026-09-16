import type { Server } from "node:http";
import type { DependencyContainer } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { shutdownRateLimitStore } from "@core/http/middlewares/rate-limit-store";
import type {
  ICacheProvider,
  IEventBus,
  IFlowProducer,
  IQueueProvider,
} from "@shared/provider";
import type { ShutdownPlan } from "./graceful-shutdown";

export interface ShutdownPlanDeps {
  readonly container: Pick<DependencyContainer, "resolve">;
  readonly server: Pick<Server, "close">;
  /**
   * Closes the WhatsApp sockets (close(), NEVER logout() — that would unpair
   * the number) and releases the advisory lock. No-op when the gateway is
   * disabled or not up yet.
   */
  readonly stopWhatsAppGateway: () => Promise<void>;
}

const closeServer = (server: Pick<Server, "close">): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      // A fatal during boot can hit this before `listen` — not a teardown failure.
      if (
        error &&
        (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING"
      ) {
        reject(error);
        return;
      }
      resolve();
    });
  });

/**
 * The API's teardown order. Providers are resolved lazily (at shutdown time)
 * so building the plan at boot never instantiates a connection.
 */
export function buildShutdownPlan({
  container,
  server,
  stopWhatsAppGateway,
}: ShutdownPlanDeps): ShutdownPlan {
  return [
    // 1. Stop accepting connections and drain in-flight requests FIRST, so no
    //    request below finds its queue/cache yanked away mid-flight.
    [{ name: "http-server", run: () => closeServer(server) }],
    // 2. WhatsApp sockets + the single-replica advisory lock.
    [{ name: "whatsapp-gateway", run: stopWhatsAppGateway }],
    // 3. Everything that still produces or consumes on Redis.
    [
      {
        name: "queue",
        run: () =>
          container.resolve<IQueueProvider>(DI_TOKENS.QueueProvider).shutdown(),
      },
      {
        name: "event-bus",
        run: () => container.resolve<IEventBus>(DI_TOKENS.EventBus).shutdown(),
      },
      {
        name: "flow-producer",
        run: () =>
          container.resolve<IFlowProducer>(DI_TOKENS.FlowProducer).shutdown(),
      },
    ],
    // 4. The remaining Redis clients.
    [
      {
        name: "cache",
        run: () =>
          container
            .resolve<ICacheProvider>(DI_TOKENS.CacheProvider)
            .disconnect(),
      },
      { name: "rate-limit-store", run: shutdownRateLimitStore },
    ],
  ];
}
