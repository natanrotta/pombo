import { z } from "zod";

export const authSchema = z.object({
  // ── JWT / session ─────────────────────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters for security"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
  COOKIE_DOMAIN: z.string().optional(),
  // Optional: enables "Sign in with Google" — the backend verifies the Google
  // ID token's audience against this client id (no client secret needed).
  GOOGLE_CLIENT_ID: z.string().optional(),

  // ── Password reset / e-mail verification ──────────────────────────────────
  // FRONTEND_URL builds the reset link emailed to the user.
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  EMAIL_VERIFICATION_PIN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(15),
});
