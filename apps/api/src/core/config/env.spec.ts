import { envSchema } from "./schema";

// The REAL contract (schema/index.ts) — not a hand-copied replica. A 32-char
// JWT_SECRET is the floor the auth schema enforces.
const VALID_ENV = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("envSchema", () => {
  it("passes with the two required fields and fills every default", () => {
    const result = envSchema.safeParse(VALID_ENV);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      NODE_ENV: "local",
      API_PORT: 3333,
      LOG_LEVEL: "info",
      REDIS_HOST: "localhost",
      JWT_EXPIRES_IN: "15m",
      RATE_LIMIT_API_MAX: 120,
      CACHE_API_TOKEN_TTL_SECONDS: 60,
      WHATSAPP_ENABLED: false,
      HUMAN_PACING_ENABLED: false,
    });
  });

  it.each(["local", "development", "staging", "production", "test"])(
    "accepts NODE_ENV=%s",
    (NODE_ENV) => {
      expect(envSchema.safeParse({ ...VALID_ENV, NODE_ENV }).success).toBe(
        true,
      );
    },
  );

  it("rejects an unknown NODE_ENV and an unknown LOG_LEVEL", () => {
    expect(
      envSchema.safeParse({ ...VALID_ENV, NODE_ENV: "prod" }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({ ...VALID_ENV, LOG_LEVEL: "verbose" }).success,
    ).toBe(false);
  });

  it("requires DATABASE_URL and a JWT_SECRET of at least 32 characters", () => {
    expect(
      envSchema.safeParse({ JWT_SECRET: VALID_ENV.JWT_SECRET }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({ DATABASE_URL: VALID_ENV.DATABASE_URL }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({ ...VALID_ENV, JWT_SECRET: "too-short" }).success,
    ).toBe(false);
  });

  it("coerces numeric strings and boolean flags", () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      API_PORT: "4000",
      REDIS_PORT: "6389",
      WHATSAPP_ENABLED: "true",
    });
    expect(result.success).toBe(true);
    expect(result.data?.API_PORT).toBe(4000);
    expect(result.data?.REDIS_PORT).toBe(6389);
    expect(result.data?.WHATSAPP_ENABLED).toBe(true);
  });

  it("leaves every optional integration unset (fail-open)", () => {
    const result = envSchema.safeParse(VALID_ENV);
    expect(result.data?.BUGSNAG_API_KEY).toBeUndefined();
    expect(result.data?.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(result.data?.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(result.data?.RESEND_API_KEY).toBeUndefined();
  });

  it("refuses a 0 rate-limit window/max (would silently disable the limiter)", () => {
    expect(
      envSchema.safeParse({ ...VALID_ENV, RATE_LIMIT_AUTH_MAX: "0" }).success,
    ).toBe(false);
  });

  it("caps the API-token cache TTL at 300 s (the revocation-propagation window)", () => {
    expect(
      envSchema.safeParse({ ...VALID_ENV, CACHE_API_TOKEN_TTL_SECONDS: "301" })
        .success,
    ).toBe(false);
  });

  it("caps SHUTDOWN_TIMEOUT_MS at the prod stop grace (60 s)", () => {
    expect(
      envSchema.safeParse({ ...VALID_ENV, SHUTDOWN_TIMEOUT_MS: "60001" })
        .success,
    ).toBe(false);
    expect(
      envSchema.safeParse({ ...VALID_ENV, SHUTDOWN_TIMEOUT_MS: "60000" })
        .success,
    ).toBe(true);
  });

  it("rejects an inverted pacer [min, max] pair and names the offending field", () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      TYPING_MIN_MS: "5000",
      TYPING_MAX_MS: "1000",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          path: ["TYPING_MIN_MS"],
          message: "TYPING_MIN_MS must be <= TYPING_MAX_MS",
        }),
      ]);
    }
  });
});
