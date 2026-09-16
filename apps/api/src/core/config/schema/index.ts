import { z } from "zod";
import { coreSchema } from "./core.schema";
import { databaseSchema } from "./database.schema";
import { redisSchema } from "./redis.schema";
import { authSchema } from "./auth.schema";
import { mailSchema } from "./mail.schema";
import { storageSchema } from "./storage.schema";
import { observabilitySchema } from "./observability.schema";
import { rateLimitSchema } from "./rate-limit.schema";
import { whatsAppSchema, refineWhatsAppPacing } from "./whatsapp.schema";
import { cacheSchema } from "./cache.schema";

/**
 * The env contract, one schema per concern, merged FLAT on purpose: `env.X`
 * keeps the SCREAMING_CASE name of the variable, the `AppConfig` port is
 * satisfied structurally, and `.env.example` documents every key (pinned by
 * `env-example.spec.ts`). Pure — no dotenv, no `process.env`, no exit — so
 * the real contract is what `env.spec.ts` tests.
 */
export const envObjectSchema = z.object({
  ...coreSchema.shape,
  ...databaseSchema.shape,
  ...redisSchema.shape,
  ...authSchema.shape,
  ...mailSchema.shape,
  ...storageSchema.shape,
  ...observabilitySchema.shape,
  ...rateLimitSchema.shape,
  ...whatsAppSchema.shape,
  ...cacheSchema.shape,
});

export const envSchema = envObjectSchema.superRefine(refineWhatsAppPacing);

export type Env = z.infer<typeof envSchema>;
