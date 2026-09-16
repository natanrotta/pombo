import type { ILoggerProvider } from "@shared/provider/logger-provider.interface";

export interface ShutdownStep {
  readonly name: string;
  readonly run: () => Promise<void>;
}

/** Stages run in order; the steps inside one stage run concurrently. */
export type ShutdownPlan = ReadonlyArray<ReadonlyArray<ShutdownStep>>;

export interface GracefulShutdownOptions {
  readonly logger: ILoggerProvider;
  readonly plan: ShutdownPlan;
  /**
   * Hard ceiling for the whole teardown. Must stay under the orchestrator's
   * kill grace (`stop_grace_period` in the prod compose) so a hung step still
   * ends in our own exit code instead of a SIGKILL. The app passes
   * `SHUTDOWN_TIMEOUT_MS`.
   */
  readonly timeoutMs?: number;
  /**
   * Delivers a fatal error (uncaught exception / unhandled rejection) to the
   * error reporter. Awaited alongside the plan and bounded by `timeoutMs`, so
   * the report leaves the process before it exits — the app owns the exit,
   * the SDK's own process-level listeners stay off. Must never reject.
   */
  readonly report?: (error: Error) => Promise<void>;
  /** Injected for tests; `process.exit` in production. */
  readonly exit?: (code: number) => void;
  /** Where the signals come from; `process` in production. */
  readonly source?: NodeJS.EventEmitter;
}

export interface GracefulShutdown {
  /** Runs the plan once; a second call while it runs returns the same promise. */
  shutdown(reason: string, exitCode?: number): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

const describeError = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { message: String(error) };

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason));

/**
 * Process lifecycle in one place: SIGTERM/SIGINT → orderly teardown → exit 0;
 * an uncaught exception or unhandled rejection → the same teardown → exit 1.
 *
 * Every step is awaited with `allSettled`, so one failing teardown (Redis
 * already gone, say) is logged and never blocks the steps after it — the
 * WhatsApp sockets still close without logging out and the advisory lock is
 * still released. A step that hangs is bounded by `timeoutMs`.
 */
export function installGracefulShutdown(
  options: GracefulShutdownOptions,
): GracefulShutdown {
  const {
    logger,
    plan,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    report,
    exit = (code) => process.exit(code),
    source = process,
  } = options;

  let inFlight: Promise<void> | null = null;
  let exited = false;
  // The timeout and the plan can both reach the exit; only the first counts.
  const finish = (code: number): void => {
    if (exited) return;
    exited = true;
    exit(code);
  };

  const runPlan = async (reason: string): Promise<void> => {
    for (const stage of plan) {
      // `Promise.resolve().then(...)` turns a step that throws synchronously
      // into a rejection, so it is isolated like any other failed step.
      const results = await Promise.allSettled(
        stage.map((step) => Promise.resolve().then(() => step.run())),
      );
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.error(
            {
              reason,
              step: stage[index]!.name,
              ...describeError(result.reason),
            },
            "Shutdown step failed",
          );
        }
      });
    }
  };

  const run = (
    reason: string,
    exitCode: number,
    fatal?: Error,
  ): Promise<void> => {
    if (inFlight) {
      logger.warn({ reason }, "Shutdown already in progress");
      return inFlight;
    }
    logger.info({ reason, exitCode }, "Shutting down gracefully");

    const timer = setTimeout(() => {
      logger.error({ reason, timeoutMs }, "Shutdown timed out — exiting");
      finish(1);
    }, timeoutMs);

    const work = [runPlan(reason)];
    if (fatal && report) {
      work.push(
        report(fatal).catch((error: unknown) =>
          logger.warn(
            { reason, ...describeError(error) },
            "Fatal error report failed",
          ),
        ),
      );
    }

    inFlight = Promise.all(work).then(() => {
      clearTimeout(timer);
      logger.info({ reason, exitCode }, "Shutdown complete");
      finish(exitCode);
    });
    return inFlight;
  };

  const shutdown = (reason: string, exitCode = 0): Promise<void> =>
    run(reason, exitCode);

  source.on("SIGTERM", () => void shutdown("SIGTERM"));
  source.on("SIGINT", () => void shutdown("SIGINT"));
  source.on("uncaughtException", (error: Error) => {
    logger.error(describeError(error), "Uncaught exception");
    void run("uncaughtException", 1, toError(error));
  });
  source.on("unhandledRejection", (reason: unknown) => {
    logger.error(describeError(reason), "Unhandled promise rejection");
    void run("unhandledRejection", 1, toError(reason));
  });

  return { shutdown };
}
