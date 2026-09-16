import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "../config";
import { httpLogger } from "./logger";
import {
  errorHandlerMiddleware,
  localeMiddleware,
  csrfProtection,
} from "./middlewares";
import { createRateLimitStore } from "./middlewares/rate-limit-store";
import { router } from "./routes";
import { publicApiRoutes } from "@modules/public-api/infrastructure/route/public-api.routes";
import { expressRequestHandler } from "../service/error-reporter";
import { i18n } from "@shared/i18n";
import { ErrorCodes } from "@shared/error";

const app = express();

app.set("trust proxy", 1);

// Error-reporter request context — FIRST middleware so every breadcrumb and
// metadata entry for the request lifecycle is scoped to this request.
app.use(expressRequestHandler());

// Hardened CSP. API responses are JSON, so script/style execution should
// never happen from an API origin in a normal browser flow.
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  connectSrc: ["'self'"],
  imgSrc: ["'self'", "data:", "https:"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  upgradeInsecureRequests: [],
};

app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: { directives: cspDirectives },
  }),
);

app.use(localeMiddleware);

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
    max: env.RATE_LIMIT_GLOBAL_MAX,
    store: createRateLimitStore("global"),
    passOnStoreError: true,
    handler: (req, res) => {
      const locale = req.locale || "pt-BR";
      const message = i18n.t(`errors:${ErrorCodes.RATE_LIMIT}`, {
        lng: locale,
      });
      res.status(429).json({
        ok: false,
        error: { message, code: ErrorCodes.RATE_LIMIT },
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Project is behind `app.set("trust proxy", 1)` — opt out of the
    // upstream startup warning. Consistent with every other rate-limit
    // middleware in this codebase.
    validate: { ip: false, keyGeneratorIpFallback: false },
  }),
);

const allowedOrigins = env.ALLOWED_ORIGIN.split(",").map((o) => o.trim());

app.use(
  cors({
    origin:
      env.NODE_ENV === "production"
        ? allowedOrigins.filter((o) => o !== "*")
        : allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept-Language",
      "X-CSRF-Token",
      // Public API send-text + internal message send accept this header; browser
      // consumers need it whitelisted for the preflight to pass.
      "Idempotency-Key",
    ],
    // The rate limiters send `Retry-After`; cross-origin, the browser hides any
    // response header that is not exposed here, and the web shows the wait.
    exposedHeaders: ["Retry-After"],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));

app.use(httpLogger);

// Public token API (Authorization: Bearer pmb_…). Header-authenticated with no
// cookies, so it is CSRF-exempt by construction — mounted BEFORE csrfProtection.
// It carries its own token auth + per-token rate limit inside the router. Still
// sits behind helmet, the global rate limit, CORS and the JSON body parser
// above.
app.use("/api/v1", publicApiRoutes);

app.use(csrfProtection);

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.use("/api", router);

app.use((req, res) => {
  const locale = req.locale || "pt-BR";
  const message = i18n.t(`errors:${ErrorCodes.NOT_FOUND}`, { lng: locale });
  return res.status(404).json({
    ok: false,
    error: { message, code: ErrorCodes.NOT_FOUND },
  });
});

// Error reporting funnels through errorHandlerMiddleware (the single 4-arg
// Express error handler), which calls errorReporter.notify with explicit
// severity + metadata.
app.use(errorHandlerMiddleware);

export { app };
