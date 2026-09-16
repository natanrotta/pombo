import { z } from "zod";

// Resend — optional (unset disables sending, fail-open).
export const mailSchema = z.object({
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Pombo <no-reply@example.com>"),
  // Dev-only: reroute all outgoing mail to this address. Ignored in prod.
  MAIL_DEV_REDIRECT_TO: z.string().optional(),
});
