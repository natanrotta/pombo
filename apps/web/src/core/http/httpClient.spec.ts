import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "@pombo/shared-types";
import { httpClient } from "./httpClient";

const CSRF_COOKIE = "pombo_csrf";

function setCsrfCookie(value: string | null) {
  document.cookie = value
    ? `${CSRF_COOKIE}=${value}; path=/`
    : `${CSRF_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** First call: 401 AUTH_TOKEN_EXPIRED; every later call: 200 `{ ok, data }`. */
function expiringAdapter(): AxiosAdapter {
  let calls = 0;
  return async (config: InternalAxiosRequestConfig) => {
    calls += 1;
    if (calls === 1) {
      const response = {
        data: {
          ok: false,
          error: { message: "Token expired", code: ErrorCodes.AUTH_TOKEN_EXPIRED },
        },
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
      };
      throw new AxiosError("401", "ERR_BAD_REQUEST", config, null, response);
    }
    return {
      data: { ok: true, data: { retried: true } },
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    };
  };
}

const spyOnRefresh = () =>
  vi.spyOn(axios, "post").mockResolvedValue({ data: {} });

describe("httpClient silent refresh", () => {
  const originalAdapter = httpClient.defaults.adapter;
  let refreshSpy: ReturnType<typeof spyOnRefresh>;

  beforeEach(() => {
    httpClient.defaults.adapter = expiringAdapter();
    refreshSpy = spyOnRefresh();
  });

  afterEach(() => {
    httpClient.defaults.adapter = originalAdapter;
    refreshSpy.mockRestore();
    setCsrfCookie(null);
  });

  it("sends the CSRF double-submit header with the refresh and replays the request", async () => {
    setCsrfCookie("csrf-abc");

    const data = await httpClient.get("/devices");

    expect(data).toEqual({ retried: true });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    const [url, body, config] = refreshSpy.mock.calls[0]!;
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(body).toEqual({});
    expect(config).toMatchObject({
      withCredentials: true,
      headers: { "X-CSRF-Token": "csrf-abc" },
    });
  });

  it("omits the header when there is no CSRF cookie", async () => {
    await httpClient.get("/devices");

    const [, , config] = refreshSpy.mock.calls[0]!;
    expect(
      (config as { headers: Record<string, string> }).headers,
    ).not.toHaveProperty("X-CSRF-Token");
  });
});

describe("httpClient cancellation", () => {
  const originalAdapter = httpClient.defaults.adapter;

  afterEach(() => {
    httpClient.defaults.adapter = originalAdapter;
  });

  it("rejects an aborted request as a cancellation, not a network error", async () => {
    httpClient.defaults.adapter = (config) =>
      new Promise((_resolve, reject) => {
        config.signal?.addEventListener?.("abort", () =>
          reject(new axios.CanceledError(undefined, undefined, config)),
        );
      });
    const controller = new AbortController();

    const request = httpClient.get("/devices", { signal: controller.signal });
    controller.abort();

    const error = await request.catch((e: unknown) => e);
    expect(axios.isCancel(error)).toBe(true);
  });
});

