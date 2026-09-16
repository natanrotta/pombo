import type { DependencyContainer } from "tsyringe";
import { buildShutdownPlan } from "./shutdown-plan";
import { DI_TOKENS } from "@core/container/tokens";

const rateLimitStore = vi.hoisted(() => ({ shutdown: vi.fn() }));
vi.mock("@core/http/middlewares/rate-limit-store", () => ({
  shutdownRateLimitStore: rateLimitStore.shutdown,
}));

describe("buildShutdownPlan", () => {
  const providers = {
    [DI_TOKENS.QueueProvider]: {
      shutdown: vi.fn().mockResolvedValue(undefined),
    },
    [DI_TOKENS.EventBus]: { shutdown: vi.fn().mockResolvedValue(undefined) },
    [DI_TOKENS.FlowProducer]: {
      shutdown: vi.fn().mockResolvedValue(undefined),
    },
    [DI_TOKENS.CacheProvider]: {
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
  } as const;
  const resolve = vi.fn(
    (token: string) => providers[token as keyof typeof providers],
  );
  const container = { resolve } as unknown as Pick<
    DependencyContainer,
    "resolve"
  >;
  const stopWhatsAppGateway = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitStore.shutdown.mockResolvedValue(undefined);
  });

  it("drains HTTP first, then the gateway, then the queues, then the remaining Redis clients", () => {
    const server = { close: vi.fn((cb?: (err?: Error) => void) => cb?.()) };
    const plan = buildShutdownPlan({
      container,
      server: server as never,
      stopWhatsAppGateway,
    });

    expect(plan.map((stage) => stage.map((step) => step.name))).toEqual([
      ["http-server"],
      ["whatsapp-gateway"],
      ["queue", "event-bus", "flow-producer"],
      ["cache", "rate-limit-store"],
    ]);
  });

  it("resolves providers lazily — building the plan touches nothing", () => {
    const server = { close: vi.fn() };
    buildShutdownPlan({
      container,
      server: server as never,
      stopWhatsAppGateway,
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(server.close).not.toHaveBeenCalled();
  });

  it("running every step closes the server and every provider exactly once", async () => {
    const server = { close: vi.fn((cb?: (err?: Error) => void) => cb?.()) };
    const plan = buildShutdownPlan({
      container,
      server: server as never,
      stopWhatsAppGateway,
    });

    for (const stage of plan)
      await Promise.all(stage.map((step) => step.run()));

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(stopWhatsAppGateway).toHaveBeenCalledTimes(1);
    expect(providers[DI_TOKENS.QueueProvider].shutdown).toHaveBeenCalledTimes(
      1,
    );
    expect(providers[DI_TOKENS.EventBus].shutdown).toHaveBeenCalledTimes(1);
    expect(providers[DI_TOKENS.FlowProducer].shutdown).toHaveBeenCalledTimes(1);
    expect(providers[DI_TOKENS.CacheProvider].disconnect).toHaveBeenCalledTimes(
      1,
    );
    expect(rateLimitStore.shutdown).toHaveBeenCalledTimes(1);
  });

  it("treats a server that never started listening as already closed", async () => {
    const notRunning = Object.assign(new Error("not running"), {
      code: "ERR_SERVER_NOT_RUNNING",
    });
    const server = {
      close: vi.fn((cb?: (err?: Error) => void) => cb?.(notRunning)),
    };
    const plan = buildShutdownPlan({
      container,
      server: server as never,
      stopWhatsAppGateway,
    });

    await expect(plan[0]![0]!.run()).resolves.toBeUndefined();
  });

  it("surfaces any other server.close error", async () => {
    const server = {
      close: vi.fn((cb?: (err?: Error) => void) => cb?.(new Error("EBUSY"))),
    };
    const plan = buildShutdownPlan({
      container,
      server: server as never,
      stopWhatsAppGateway,
    });

    await expect(plan[0]![0]!.run()).rejects.toThrow("EBUSY");
  });
});
