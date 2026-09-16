import { z } from "zod";

// Object storage (S3) — optional (unset disables uploads).
export const storageSchema = z.object({
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
});
