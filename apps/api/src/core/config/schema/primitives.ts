import { z } from "zod";

/**
 * A `true`/`false` env flag. Env vars are strings — the transform is what
 * turns `WHATSAPP_ENABLED=true` into a boolean so call sites never compare
 * against the string.
 */
export const envFlag = () =>
  z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true");
