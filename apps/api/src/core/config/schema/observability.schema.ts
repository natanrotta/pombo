import { z } from "zod";

// All optional — every integration here fails open when unset.
export const observabilitySchema = z.object({
  // Unset BUGSNAG disables error reporting.
  BUGSNAG_API_KEY: z.string().optional(),
  // App version / git commit surfaced by GET /api/health. CI stamps these.
  APP_VERSION: z.string().optional(),
  GIT_COMMIT: z.string().optional(),
  COMMIT_SHA: z.string().optional(),
  // node_exporter scrape URLs (host metrics), one per host.
  METRICS_APP_URL: z.string().url().optional(),
  METRICS_DATA_URL: z.string().url().optional(),
  // GitHub Actions read-only token + repo, for CI/CD run listing.
  GITHUB_ACTIONS_TOKEN: z.string().optional(),
  GITHUB_REPO: z.string().default("owner/repo"),
});
