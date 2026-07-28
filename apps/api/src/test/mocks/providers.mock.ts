import { IHashProvider } from "@shared/provider/hash-provider.interface";
import { IJwtProvider } from "@shared/provider/jwt-provider.interface";
import { ICacheProvider } from "@shared/provider/cache-provider.interface";
import { IStorageProvider } from "@shared/provider/storage-provider.interface";
import { IQueueProvider } from "@shared/provider/queue-provider.interface";
import { ILoggerProvider } from "@shared/provider/logger-provider.interface";
import { IMailProvider } from "@shared/provider/mail-provider.interface";
import { IDatabaseStatusProvider } from "@shared/provider/database-status-provider.interface";
import { INodeExporterMetricsProvider } from "@shared/provider/node-exporter-metrics-provider.interface";
import { ISendRateLimiter } from "@modules/messaging/domain/provider/send-rate-limiter.interface";
import { ISendPacer } from "@modules/messaging/domain/provider/send-pacer.interface";
import { AppConfig } from "@shared/provider/app-config.interface";

type MockOf<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : T[K];
};

export function mockHashProvider(): MockOf<IHashProvider> {
  return {
    hash: vi.fn(),
    compare: vi.fn(),
  };
}

export function mockJwtProvider(): MockOf<IJwtProvider> {
  return {
    sign: vi.fn(),
    verify: vi.fn(),
    generateRefreshToken: vi.fn(),
    hashRefreshToken: vi.fn((raw: string) => `hashed-${raw}`),
    generateTokenPair: vi.fn(),
    issueRefreshCredential: vi.fn(),
    signScoped: vi.fn(),
  };
}

export function mockCacheProvider(): MockOf<ICacheProvider> & {
  isAvailable: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    increment: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(true),
    getStatus: vi.fn().mockResolvedValue({ reachable: true }),
    disconnect: vi.fn(),
  };
}

export function mockStorageProvider(): MockOf<IStorageProvider> {
  return {
    checkHealth: vi
      .fn()
      .mockResolvedValue({ configured: true, reachable: true }),
    upload: vi.fn(),
    delete: vi.fn(),
    getSignedUrl: vi.fn(),
    getBuffer: vi.fn(),
    getPresignedPutUrl: vi.fn(),
    getDownloadStream: vi.fn(),
  };
}

export function mockQueueProvider(): MockOf<IQueueProvider> {
  return {
    createQueue: vi.fn(),
    addJob: vi.fn(),
    registerProcessor: vi.fn(),
    removeJob: vi.fn().mockResolvedValue(true),
    getFailedJobs: vi.fn().mockResolvedValue([]),
    getQueueHealth: vi.fn().mockResolvedValue({
      queueName: "test",
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      oldestWaitingMs: null,
      sampledAt: new Date(),
    }),
    getAllQueueStatuses: vi.fn().mockResolvedValue([]),
    shutdown: vi.fn(),
  };
}

export function mockDatabaseStatusProvider(): MockOf<IDatabaseStatusProvider> {
  return {
    getStatus: vi.fn().mockResolvedValue({ reachable: true }),
  };
}

export function mockNodeExporterMetricsProvider(): MockOf<INodeExporterMetricsProvider> {
  return {
    fetchHost: vi.fn().mockResolvedValue({ reachable: false }),
    fetchApp: vi.fn().mockResolvedValue({ reachable: false }),
    fetchData: vi.fn().mockResolvedValue({ reachable: false }),
  };
}

export function mockLoggerProvider(): MockOf<ILoggerProvider> {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

export function mockMailProvider(): MockOf<IMailProvider> {
  return {
    send: vi.fn(),
  };
}

/** Always-allow send rate limiter — use in use-case tests that don't exercise
 *  throttling (real throttling is tested in the token-bucket spec). */
export function mockSendRateLimiter(): MockOf<ISendRateLimiter> {
  return {
    tryConsume: vi.fn().mockReturnValue(true),
    msUntilNextToken: vi.fn().mockReturnValue(0),
  };
}

/** Human send pacer stub — no typing, no pause by default (fast; effectively the
 *  human-pacing-off behavior). Override the return values per test to exercise
 *  typing/long-pause. */
export function mockSendPacer(): MockOf<ISendPacer> {
  return {
    typingDelayMs: vi.fn().mockReturnValue(0),
    longPauseMs: vi.fn().mockReturnValue(0),
  };
}

/**
 * Plain-value AppConfig for constructing SUTs that inject the config port.
 * Defaults mirror the dev env defaults; override per-test as needed.
 */
export function mockAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    FRONTEND_URL: "http://localhost:3000",
    PASSWORD_RESET_TOKEN_TTL_MINUTES: 60,
    EMAIL_VERIFICATION_PIN_TTL_MINUTES: 15,
    // WhatsApp Gateway (pombo) defaults — mirror the env defaults.
    WHATSAPP_ENABLED: false,
    DISCONNECT_DEBOUNCE_MS: 30000,
    RECONNECT_BASE_DELAY_MS: 3000,
    RECONNECT_MAX_DELAY_MS: 300000,
    OUTBOX_TTL_HOURS: 24,
    OUTBOX_PRUNE_INTERVAL_MS: 3600000,
    // High ceiling in tests so the rate limiter never gets in the way unless a
    // test overrides it to exercise throttling.
    SEND_RATE_MAX: 1000,
    SEND_RATE_WINDOW_MS: 60000,
    // Human send pacer (rhythm under the rate ceiling) — defaults mirror env.ts.
    HUMAN_PACING_ENABLED: false,
    TYPING_MS_PER_CHAR: 50,
    TYPING_MIN_MS: 1500,
    TYPING_MAX_MS: 20000,
    SEND_JITTER_PCT: 0.3,
    LONG_PAUSE_PROBABILITY: 0.15,
    LONG_PAUSE_MIN_MS: 30000,
    LONG_PAUSE_MAX_MS: 120000,
    WEBHOOK_TIMEOUT_MS: 5000,
    WEBHOOK_MAX_ATTEMPTS: 4,
    WEBHOOK_RETRY_BASE_DELAY_MS: 1000,
    ADVISORY_LOCK_HEARTBEAT_MS: 30000,
    CACHE_ENTITY_TTL_SECONDS: 60,
    CACHE_API_TOKEN_TTL_SECONDS: 60,
    ...overrides,
  };
}
