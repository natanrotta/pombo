/**
 * Single source of truth for DI tokens (tsyringe injection keys).
 *
 * tsyringe accepts arbitrary strings as `@inject(...)` tokens, which makes
 * typos silent runtime failures. This const collects every token in one place
 * so new registrations have a typed key, renames are find-and-replace, and IDE
 * autocomplete works at the registration site.
 *
 * Class-based tokens (e.g. `@inject(SomeService)`) are type-safe natively and
 * do not need an entry here.
 */
export const DI_TOKENS = {
  // ── Repositories ────────────────────────────────────────────────────────
  UserRepository: "UserRepository",
  PasswordResetTokenRepository: "PasswordResetTokenRepository",
  EmailVerificationPinRepository: "EmailVerificationPinRepository",

  // Account (tenancy + public-API credential)
  ApiTokenRepository: "ApiTokenRepository",

  // WhatsApp Gateway (pombo)
  DevicesRepository: "DevicesRepository",
  AuthStateRepository: "AuthStateRepository",
  OutboxRepository: "OutboxRepository",

  // ── Providers ──────────────────────────────────────────────────────────
  CacheProvider: "CacheProvider",
  /** Read-only Postgres health probe. */
  DatabaseStatusProvider: "DatabaseStatusProvider",
  /** node_exporter scrape adapter for host metrics. */
  NodeExporterMetricsProvider: "NodeExporterMetricsProvider",
  /** GitHub Actions adapter (CI/CD runs). */
  CiProvider: "CiProvider",
  HashProvider: "HashProvider",
  JwtProvider: "JwtProvider",
  StorageProvider: "StorageProvider",
  QueueProvider: "QueueProvider",
  FlowProducer: "FlowProducer",
  EventBus: "EventBus",
  LoggerProvider: "LoggerProvider",
  MailProvider: "MailProvider",

  // WhatsApp Gateway (pombo) providers
  /** Typed in-process domain event bus (session + message-status vocabulary).
   *  Distinct from `EventBus` (Redis pub/sub for SSE). */
  DomainEventBus: "DomainEventBus",
  /** The WhatsApp gateway port. Bound to the disabled no-op or the Baileys
   *  impl depending on `WHATSAPP_ENABLED`. */
  WhatsAppGateway: "WhatsAppGateway",
  /** Signs + delivers webhooks (HMAC-SHA256, bounded retries). */
  WebhookSender: "WebhookSender",
  /** Resolves an outbox row's original text from a waMessageId — injected into
   *  the Baileys getMessage so `devices` never imports `messaging`. */
  ResolveOutboxText: "ResolveOutboxText",
  /** Per-device disconnect debouncer (collapses socket flaps). */
  DisconnectDebouncer: "DisconnectDebouncer",
  /** Per-device outbound send rate limiter (anti-ban throttle). */
  SendRateLimiter: "SendRateLimiter",
  /** Human send pacer — typing/jitter rhythm under the SendRateLimiter ceiling. */
  SendPacer: "SendPacer",

  // ── Application services ──────────────────────────────────────────────
  AuthProfileBuilder: "AuthProfileBuilder",
  /** AES-256-GCM encryption service (generic infra). */
  AesGcmEncryptionService: "AesGcmEncryptionService",
  /** Plain config object `{key: Buffer}` for AesGcmEncryptionService. */
  AesGcmEncryptionConfig: "AesGcmEncryptionConfig",

  // ── Config values ─────────────────────────────────────────────────────
  /** The parsed env object exposed through the `AppConfig` domain port, so
   *  application code consumes config via DI instead of importing
   *  `@core/config` (BASELINE R8 / B-C10). */
  AppConfig: "AppConfig",
  GoogleClientId: "GoogleClientId",
  /** Public FE base URL used when application use cases compose links the user
   *  will click (password-reset emails). Injected as a string so the
   *  application layer never imports `@core/config/env` (BASELINE R8). */
  FrontendUrl: "FrontendUrl",
  /** App version / git commit string surfaced by the health endpoint. */
  ApiVersion: "ApiVersion",
  /** Resolved `NODE_ENV`, injected as a string. */
  ApiEnv: "ApiEnv",
} as const;

export type DiToken = (typeof DI_TOKENS)[keyof typeof DI_TOKENS];
