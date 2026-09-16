import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockBugsnag, mockEnv, mockRequestHandler, mockLogger } = vi.hoisted(
  () => {
    const mockRequestHandler = vi.fn();
    return {
      mockRequestHandler,
      mockBugsnag: {
        start: vi.fn(),
        notify: vi.fn(),
        leaveBreadcrumb: vi.fn(),
        getPlugin: vi.fn(() => ({ requestHandler: mockRequestHandler })),
      },
      mockEnv: {
        BUGSNAG_API_KEY: undefined as string | undefined,
        NODE_ENV: "test",
      },
      mockLogger: { info: vi.fn(), warn: vi.fn() },
    };
  },
);

vi.mock("@bugsnag/js", () => ({ default: mockBugsnag }));
vi.mock("@bugsnag/plugin-express", () => ({ default: {} }));
vi.mock("../../config", () => ({ env: mockEnv }));
vi.mock("@core/http/logger", () => ({
  logger: mockLogger,
}));

/**
 * Fresh import per test so the module-level `started` flag resets — the no-op
 * guards depend on it and would leak state across cases otherwise.
 */
async function loadModule() {
  vi.resetModules();
  return import("./index.js");
}

describe("error-reporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.BUGSNAG_API_KEY = undefined;
    mockEnv.NODE_ENV = "test";
  });

  describe("initErrorReporter", () => {
    it("no-ops (does not start Bugsnag) when BUGSNAG_API_KEY is unset", async () => {
      const { initErrorReporter } = await loadModule();

      initErrorReporter();

      expect(mockBugsnag.start).not.toHaveBeenCalled();
    });

    it.each(["test", "local", "development"] as const)(
      "logs the missing key at INFO in non-deployed stage %s (no key expected there)",
      async (stage) => {
        mockEnv.NODE_ENV = stage;
        const { initErrorReporter } = await loadModule();

        initErrorReporter();

        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      },
    );

    it.each(["production", "staging"] as const)(
      "logs the missing key at WARN in deployed stage %s (the silent prod gap)",
      async (stage) => {
        mockEnv.NODE_ENV = stage;
        const { initErrorReporter } = await loadModule();

        initErrorReporter();

        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn.mock.calls[0]![0]).toMatchObject({
          service: "bugsnag",
          releaseStage: stage,
        });
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockBugsnag.start).not.toHaveBeenCalled();
      },
    );

    it("starts Bugsnag with the key and PHI-hardening config when set", async () => {
      mockEnv.BUGSNAG_API_KEY = "test-key";
      const { initErrorReporter } = await loadModule();

      initErrorReporter();

      expect(mockBugsnag.start).toHaveBeenCalledTimes(1);
      const config = mockBugsnag.start.mock.calls[0]![0];
      expect(config.apiKey).toBe("test-key");
      expect(config.collectUserIp).toBe(false);
      // The lifecycle owns process exit — the SDK must not race it.
      expect(config.enabledErrorTypes).toEqual({
        unhandledExceptions: false,
        unhandledRejections: false,
      });
      expect(config.onError).toBeTypeOf("function");
      expect(config.onBreadcrumb).toBeTypeOf("function");
    });

    it("is idempotent — a second call does not start Bugsnag twice", async () => {
      mockEnv.BUGSNAG_API_KEY = "test-key";
      const { initErrorReporter } = await loadModule();

      initErrorReporter();
      initErrorReporter();

      expect(mockBugsnag.start).toHaveBeenCalledTimes(1);
    });
  });

  describe("onError PHI scrubbing", () => {
    it("drops auth headers + request body and reduces the user to an opaque id", async () => {
      mockEnv.BUGSNAG_API_KEY = "test-key";
      const { initErrorReporter } = await loadModule();
      initErrorReporter();

      const onError = mockBugsnag.start.mock.calls[0]![0].onError as (
        e: unknown,
      ) => boolean;

      const setUser = vi.fn();
      const event = {
        request: {
          headers: { authorization: "Bearer x", cookie: "s=1", "x-keep": "ok" },
          body: { patientName: "Ana" },
        },
        getUser: () => ({ id: "u1", email: "ana@example.com", name: "Ana" }),
        setUser,
      };

      const result = onError(event);

      expect(result).toBe(true);
      expect(event.request.headers).not.toHaveProperty("authorization");
      expect(event.request.headers).not.toHaveProperty("cookie");
      expect(event.request.headers).toHaveProperty("x-keep", "ok");
      expect(event.request).not.toHaveProperty("body");
      // Only the opaque id is kept — email/name (a patient name risk) dropped.
      expect(setUser).toHaveBeenCalledWith("u1");
    });
  });

  describe("errorReporter facade (no-op until started)", () => {
    it("notify no-ops before init", async () => {
      const { errorReporter } = await loadModule();

      errorReporter.notify(new Error("boom"));

      expect(mockBugsnag.notify).not.toHaveBeenCalled();
    });

    it("leaveBreadcrumb no-ops before init", async () => {
      const { errorReporter } = await loadModule();

      errorReporter.leaveBreadcrumb("hello", { level: "info" });

      expect(mockBugsnag.leaveBreadcrumb).not.toHaveBeenCalled();
    });

    it("notify forwards to Bugsnag after a successful init", async () => {
      mockEnv.BUGSNAG_API_KEY = "test-key";
      const { initErrorReporter, errorReporter } = await loadModule();
      initErrorReporter();

      const error = new Error("boom");
      errorReporter.notify(error);

      expect(mockBugsnag.notify).toHaveBeenCalledWith(
        error,
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("leaveBreadcrumb forwards to Bugsnag with the log type after init", async () => {
      mockEnv.BUGSNAG_API_KEY = "test-key";
      const { initErrorReporter, errorReporter } = await loadModule();
      initErrorReporter();

      errorReporter.leaveBreadcrumb("hello", { level: "info", userId: "u1" });

      expect(mockBugsnag.leaveBreadcrumb).toHaveBeenCalledWith(
        "hello",
        { level: "info", userId: "u1" },
        "log",
      );
    });
  });

  describe("onBreadcrumb filter", () => {
    it("drops /healthz breadcrumbs and keeps the rest", async () => {
      mockEnv.BUGSNAG_API_KEY = "test-key";
      const { initErrorReporter } = await loadModule();
      initErrorReporter();

      const onBreadcrumb = mockBugsnag.start.mock.calls[0]![0]
        .onBreadcrumb as (b: { metadata: Record<string, unknown> }) => boolean;

      expect(onBreadcrumb({ metadata: { url: "/healthz" } })).toBe(false);
      expect(onBreadcrumb({ metadata: { url: "/api/patients" } })).toBe(true);
    });
  });

  describe("expressRequestHandler", () => {
    it("returns a pass-through middleware before init", async () => {
      const { expressRequestHandler } = await loadModule();

      const handler = expressRequestHandler();
      const next = vi.fn();
      handler({} as never, {} as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockBugsnag.getPlugin).not.toHaveBeenCalled();
    });

    it("returns the express plugin's requestHandler after init", async () => {
      mockEnv.BUGSNAG_API_KEY = "test-key";
      const { initErrorReporter, expressRequestHandler } = await loadModule();
      initErrorReporter();

      const handler = expressRequestHandler();

      expect(mockBugsnag.getPlugin).toHaveBeenCalledWith("express");
      expect(handler).toBe(mockRequestHandler);
    });
  });
});
