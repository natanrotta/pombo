import { EventEmitter } from "node:events";
import {
  installGracefulShutdown,
  type ShutdownStep,
} from "./graceful-shutdown";
import { mockLoggerProvider } from "@test/mocks";

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("installGracefulShutdown", () => {
  const install = (
    plan: ShutdownStep[][],
    timeoutMs?: number,
    report?: (error: Error) => Promise<void>,
  ) => {
    const source = new EventEmitter();
    const exit = vi.fn();
    const logger = mockLoggerProvider();
    const api = installGracefulShutdown({
      logger,
      plan,
      exit,
      source,
      timeoutMs,
      report,
    });
    return { source, exit, logger, api };
  };

  afterEach(() => vi.useRealTimers());

  it("runs stages in order — a stage starts only after the previous one settled — then exits 0 on SIGTERM", async () => {
    const first = deferred();
    const started: string[] = [];
    const step = (name: string, wait?: Promise<void>): ShutdownStep => ({
      name,
      run: async () => {
        started.push(name);
        await wait;
      },
    });
    const { source, exit } = install([[step("a", first.promise)], [step("b")]]);

    source.emit("SIGTERM");
    await tick();
    expect(started).toEqual(["a"]);

    first.resolve();
    await tick();
    await tick();
    expect(started).toEqual(["a", "b"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("runs the steps of one stage concurrently", async () => {
    const gate = deferred();
    const started: string[] = [];
    const step = (name: string): ShutdownStep => ({
      name,
      run: async () => {
        started.push(name);
        await gate.promise;
      },
    });
    const { source } = install([[step("x"), step("y"), step("z")]]);

    source.emit("SIGINT");
    await tick();
    expect(started).toEqual(["x", "y", "z"]);
    gate.resolve();
  });

  it("logs a failing step and still runs the later stages and exits", async () => {
    const later = vi.fn().mockResolvedValue(undefined);
    const { source, exit, logger } = install([
      [{ name: "redis", run: () => Promise.reject(new Error("ECONNRESET")) }],
      [{ name: "later", run: later }],
    ]);

    source.emit("SIGTERM");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(later).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ step: "redis", message: "ECONNRESET" }),
      "Shutdown step failed",
    );
  });

  it("isolates a step that throws synchronously exactly like a rejected one", async () => {
    const later = vi.fn().mockResolvedValue(undefined);
    const { source, exit, logger } = install([
      [
        {
          name: "sync-throw",
          run: () => {
            throw new Error("threw before returning a promise");
          },
        },
      ],
      [{ name: "later", run: later }],
    ]);

    source.emit("SIGTERM");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(later).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ step: "sync-throw" }),
      "Shutdown step failed",
    );
  });

  it("is idempotent — a second signal during teardown does not re-run the plan", async () => {
    const gate = deferred();
    const run = vi.fn(() => gate.promise);
    const { source, exit, logger } = install([[{ name: "slow", run }]]);

    source.emit("SIGTERM");
    source.emit("SIGINT");
    await tick();
    expect(run).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      { reason: "SIGINT" },
      "Shutdown already in progress",
    );

    gate.resolve();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledTimes(1));
    expect(exit).toHaveBeenCalledWith(0);
  });

  it.each(["uncaughtException", "unhandledRejection"])(
    "%s runs the teardown and exits 1",
    async (event) => {
      const run = vi.fn().mockResolvedValue(undefined);
      const { source, exit, logger } = install([[{ name: "s", run }]]);

      source.emit(event, new Error("boom"));
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));

      expect(run).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: "boom" }),
        expect.any(String),
      );
    },
  );

  it("delivers the fatal error to the reporter and waits for it before exiting", async () => {
    const delivery = deferred();
    const report = vi.fn(() => delivery.promise);
    const { source, exit } = install(
      [[{ name: "s", run: vi.fn().mockResolvedValue(undefined) }]],
      undefined,
      report,
    );

    source.emit("uncaughtException", new Error("boom"));
    await tick();
    await tick();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: "boom" }),
    );
    expect(exit).not.toHaveBeenCalled(); // plan done, report still in flight

    delivery.resolve();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  });

  it("wraps a non-Error rejection reason before reporting it", async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    const { source, exit } = install([[]], undefined, report);

    source.emit("unhandledRejection", "plain string");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(report).toHaveBeenCalledWith(expect.any(Error));
    expect((report.mock.calls[0]![0] as Error).message).toBe("plain string");
  });

  it("a failing reporter never blocks the exit", async () => {
    const report = vi.fn().mockRejectedValue(new Error("bugsnag down"));
    const { source, exit, logger } = install([[]], undefined, report);

    source.emit("uncaughtException", new Error("boom"));
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: "bugsnag down" }),
      "Fatal error report failed",
    );
  });

  it("does not report on a plain signal", async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    const { source, exit } = install([[]], undefined, report);

    source.emit("SIGTERM");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(report).not.toHaveBeenCalled();
  });

  it("exits exactly once when the timeout fires first and the plan finishes later", async () => {
    vi.useFakeTimers();
    const late = deferred();
    const { source, exit } = install(
      [[{ name: "slow", run: () => late.promise }]],
      500,
    );

    source.emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(500);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);

    late.resolve();
    await vi.advanceTimersByTimeAsync(10);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("force-exits 1 when the plan outlives the timeout", async () => {
    vi.useFakeTimers();
    const never = new Promise<void>(() => {});
    const { source, exit, logger } = install(
      [[{ name: "hung", run: () => never }]],
      500,
    );

    source.emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(499);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      { reason: "SIGTERM", timeoutMs: 500 },
      "Shutdown timed out — exiting",
    );
  });
});
