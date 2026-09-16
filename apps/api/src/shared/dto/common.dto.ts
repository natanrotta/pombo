import { z } from "zod";

/**
 * Request schemas every module shares. No custom messages on purpose: a
 * schema-level message overrides the per-request `errorMap`, which is what
 * localizes validation errors (`validate-request.middleware.ts`) — plain
 * checks are the only way the `validation:string.uuid` translation applies.
 */

/** `/:id` route param — a UUID. */
export const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

export type UuidParam = z.infer<typeof UuidParamSchema>;
