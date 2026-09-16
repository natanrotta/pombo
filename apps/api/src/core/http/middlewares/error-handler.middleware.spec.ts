import { Request, Response, NextFunction } from "express";
import { errorHandlerMiddleware } from "./error-handler.middleware";
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  type ErrorCode,
} from "@shared/error";

vi.mock("../../config", () => ({
  env: { NODE_ENV: "development", LOG_LEVEL: "silent" },
}));

vi.mock("../../service/error-reporter", () => ({
  errorReporter: { notify: vi.fn() },
}));

vi.mock("@shared/i18n", () => ({
  i18n: {
    t: vi.fn((key: string) => key),
  },
}));

import { errorReporter } from "../../service/error-reporter";
import { env } from "../../config";
import { i18n } from "@shared/i18n";

/**
 * Minimal stand-in for a Bugsnag `Event`. The middleware reports via
 * `errorReporter.notify(err, onError)` and shapes severity + metadata inside
 * the `onError` callback, so the spec runs that callback against this stub to
 * assert what the report carries.
 */
function makeEvent() {
  return {
    severity: undefined as string | undefined,
    addMetadata: vi.fn(),
  };
}

/** Runs the `onError` callback the middleware passed to `notify`. */
function runNotifyCallback(call: unknown[]) {
  const event = makeEvent();
  (call[1] as (e: typeof event) => void)(event);
  return event;
}

function mockReqRes() {
  const req = {
    originalUrl: "/api/test",
    method: "GET",
    locale: "pt-BR",
    log: { error: vi.fn(), warn: vi.fn() },
  } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next, status, json };
}

describe("errorHandlerMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: return key as-is (triggers fallback to original message)
    vi.mocked(i18n.t).mockImplementation(((key: string) => key) as any);
  });

  it("should return correct status and fallback message for AppError (4xx)", () => {
    const { req, res, next, status, json } = mockReqRes();
    const error = new BadRequestError("Bad input", { field: "name" });

    errorHandlerMiddleware(error, req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0]![0];
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toBe("Bad input");
    expect(body.error.details).toEqual({ field: "name" });
  });

  it("should log warn for 4xx errors", () => {
    const { req, res, next } = mockReqRes();
    const error = new NotFoundError("Not found");

    errorHandlerMiddleware(error, req, res, next);

    expect((req.log as any).warn).toHaveBeenCalled();
    expect((req.log as any).error).not.toHaveBeenCalled();
  });

  it("should log error and report 5xx AppError with error severity", () => {
    const { req, res, next } = mockReqRes();
    const error = new InternalError("Something broke");

    errorHandlerMiddleware(error, req, res, next);

    expect((req.log as any).error).toHaveBeenCalled();
    expect(errorReporter.notify).toHaveBeenCalledWith(
      error,
      expect.any(Function),
    );

    const event = runNotifyCallback(
      vi.mocked(errorReporter.notify).mock.calls[0]!,
    );
    expect(event.severity).toBe("error");
    expect(event.addMetadata).toHaveBeenCalledWith("error", {
      errorCode: "INTERNAL_ERROR",
      statusCode: "500",
    });
    expect(event.addMetadata).toHaveBeenCalledWith("request", {
      url: "/api/test",
      method: "GET",
    });
  });

  it("strips the query string from the logged URL on a 5xx AppError (SEC-C7)", () => {
    const { req } = mockReqRes();
    (req as any).originalUrl = "/api/patients?search=joao+silva&cpf=123";
    const next = vi.fn() as unknown as NextFunction;
    const res = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    } as unknown as Response;

    errorHandlerMiddleware(new InternalError("boom"), req, res, next);

    const [logContext] = (req.log as any).error.mock.calls[0];
    expect(logContext.url).toBe("/api/patients");
    expect(logContext.url).not.toContain("?");
    // Reporter metadata stays query-free too.
    const event = runNotifyCallback(
      vi.mocked(errorReporter.notify).mock.calls[0]!,
    );
    expect(event.addMetadata).toHaveBeenCalledWith("request", {
      url: "/api/patients",
      method: "GET",
    });
  });

  it("strips the query string from the logged URL on an unhandled (non-App) error (SEC-C7)", () => {
    const { req } = mockReqRes();
    (req as any).originalUrl = "/api/consultations?note=secret";
    const next = vi.fn() as unknown as NextFunction;
    const res = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    } as unknown as Response;

    errorHandlerMiddleware(new Error("raw"), req, res, next);

    const [logContext] = (req.log as any).error.mock.calls[0];
    expect(logContext.url).toBe("/api/consultations");
    expect(logContext.url).not.toContain("?");
  });

  it("should return 500 with GENERIC_ERROR code and debug stack in dev for non-AppError", () => {
    const { req, res, next, status, json } = mockReqRes();
    const error = new Error("raw error");

    errorHandlerMiddleware(error, req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({
          message: "Internal server error",
          code: "GENERIC_ERROR",
          debug: expect.objectContaining({ stack: expect.any(String) }),
        }),
      }),
    );
  });

  it("should report non-AppError with GENERIC_ERROR metadata and error severity", () => {
    const { req, res, next } = mockReqRes();
    const error = new Error("boom");

    errorHandlerMiddleware(error, req, res, next);

    expect(errorReporter.notify).toHaveBeenCalledWith(
      error,
      expect.any(Function),
    );

    const event = runNotifyCallback(
      vi.mocked(errorReporter.notify).mock.calls[0]!,
    );
    expect(event.severity).toBe("error");
    expect(event.addMetadata).toHaveBeenCalledWith("error", {
      errorCode: "GENERIC_ERROR",
    });
    expect(event.addMetadata).toHaveBeenCalledWith("request", {
      url: "/api/test",
      method: "GET",
    });
  });

  it.each([
    ["401", () => new UnauthorizedError("nope")],
    ["403", () => new ForbiddenError("denied")],
    [
      "429",
      () =>
        new TooManyRequestsError("too many", undefined, "PUBLIC_RATE_LIMIT"),
    ],
  ])("should report %s AppError with warning severity", (_, factory) => {
    const { req, res, next } = mockReqRes();
    const error = factory();

    errorHandlerMiddleware(error, req, res, next);

    expect(errorReporter.notify).toHaveBeenCalledWith(
      error,
      expect.any(Function),
    );

    const event = runNotifyCallback(
      vi.mocked(errorReporter.notify).mock.calls[0]!,
    );
    expect(event.severity).toBe("warning");
    expect(event.addMetadata).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({ errorCode: error.code }),
    );
  });

  it("should NOT report other 4xx AppErrors", () => {
    const { req, res, next } = mockReqRes();
    const error = new NotFoundError("nothing here");

    errorHandlerMiddleware(error, req, res, next);

    expect(errorReporter.notify).not.toHaveBeenCalled();
  });

  it("should hide debug stack in production for non-AppError", () => {
    (env as any).NODE_ENV = "production";
    const { req, res, next, json } = mockReqRes();
    const error = new Error("raw error");

    errorHandlerMiddleware(error, req, res, next);

    const body = json.mock.calls[0]![0];
    expect(body.error).not.toHaveProperty("debug");

    (env as any).NODE_ENV = "development";
  });

  it("should report non-AppError instances of Error", () => {
    const { req, res, next } = mockReqRes();
    const error = new Error("unexpected");

    errorHandlerMiddleware(error, req, res, next);

    expect(errorReporter.notify).toHaveBeenCalledWith(
      error,
      expect.any(Function),
    );
  });

  it("should not crash when req.log is missing", () => {
    const req = {
      originalUrl: "/test",
      method: "GET",
      locale: "pt-BR",
    } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() =>
      errorHandlerMiddleware(new Error("no log"), req, res, next),
    ).not.toThrow();
    expect(status).toHaveBeenCalledWith(500);
  });

  it("should use translated message when i18n returns valid translation", () => {
    vi.mocked(i18n.t).mockImplementation(((key: string) => {
      if (key === "errors:NOT_FOUND") return "Recurso não encontrado";
      return key;
    }) as any);

    const { req, res, next, json } = mockReqRes();
    const error = new NotFoundError("Not found");

    errorHandlerMiddleware(error, req, res, next);

    const body = json.mock.calls[0]![0];
    expect(body.error.message).toBe("Recurso não encontrado");
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("should fallback to original message when i18n returns key unchanged", () => {
    const { req, res, next, json } = mockReqRes();
    // Cast: this test exercises the i18n fallback path. Any code that has no
    // translation entry triggers the fallback — a synthetic non-cataloged
    // code keeps the test focused on that branch.
    const error = new BadRequestError(
      "Custom error message",
      undefined,
      "UNKNOWN_CODE" as ErrorCode,
    );

    errorHandlerMiddleware(error, req, res, next);

    const body = json.mock.calls[0]![0];
    expect(body.error.message).toBe("Custom error message");
  });

  it("should pass req.locale to i18n.t", () => {
    const { req, res, next } = mockReqRes();
    req.locale = "en";
    const error = new NotFoundError("Not found");

    errorHandlerMiddleware(error, req, res, next);

    expect(i18n.t).toHaveBeenCalledWith("errors:NOT_FOUND", { lng: "en" });
  });

  it("should default to pt-BR when req.locale is not set", () => {
    const req = {
      originalUrl: "/test",
      method: "GET",
      log: { error: vi.fn(), warn: vi.fn() },
    } as unknown as Request;
    const json = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json }),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    const error = new NotFoundError("Not found");
    errorHandlerMiddleware(error, req, res, next);

    expect(i18n.t).toHaveBeenCalledWith("errors:NOT_FOUND", { lng: "pt-BR" });
  });
});
