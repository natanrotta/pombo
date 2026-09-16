import { Router } from "express";
import { authRoutes } from "@modules/auth/infrastructure/route/auth.routes";
import { accountRoutes } from "@modules/account/infrastructure/route/account.routes";
import { deviceRoutes } from "@modules/devices/infrastructure/route/device.routes";
import { messageRoutes } from "@modules/messaging/infrastructure/route/message.routes";
import { getGatewayHealth } from "@modules/devices/infrastructure/health/gateway-health";
import { userRateLimit } from "../middlewares";
import { container, DI_TOKENS } from "@core/container";

const router = Router();

// Resolved once from the container. The CI stamps APP_VERSION (the git sha)
// into the image; the deploy workflow reads this back to confirm the expected
// version actually went live ("unknown" when built outside the CI).
const apiVersion = container.resolve<string>(DI_TOKENS.ApiVersion);

// Unauthenticated health probe. Reflects PROCESS health: 200 whenever the API
// is serving. The WhatsApp gateway block (when enabled) reports how many
// devices are connected as INFORMATION — a disconnected device does NOT flip
// this to 503, so a transient drop can't trigger a restart → mass reconnect.
// Container liveness is the separate always-200 `/healthz`.
router.get("/health", async (_req, res) => {
  const gateway = await getGatewayHealth();
  return res.status(200).json({
    ok: true,
    version: apiVersion,
    uptimeSeconds: Math.round(process.uptime()),
    ...(gateway ? { gateway } : {}),
  });
});

router.use("/auth", authRoutes);

router.use(userRateLimit);

// Account settings (API-token generation) — auth-guarded inside account.routes.
router.use("/account", accountRoutes);

// WhatsApp gateway (pombo) — devices + messaging. Every route is JWT-guarded
// inside its own router. Device management under /devices; the send + status
// routes (/devices/:id/messages, /messages/:id) mount at root.
router.use("/devices", deviceRoutes);
router.use(messageRoutes);

export { router };
