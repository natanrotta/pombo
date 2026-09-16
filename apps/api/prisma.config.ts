import "dotenv/config";
import { defineConfig } from "prisma/config";

// We deliberately read DATABASE_URL via `process.env` instead of Prisma's
// `env()` helper. `env()` throws at config-load time when the variable is
// missing, which breaks `prisma generate` — and therefore the `postinstall`
// hook — on fresh clones / CI before `.env` is wired up. `prisma generate`
// doesn't need a real URL.
//
// Tradeoff: if someone runs `prisma migrate deploy` / `db pull` / etc.
// without DATABASE_URL set, the empty fallback falls through to Prisma's
// own DSN validator and surfaces as `"the URL must start with the protocol
// postgresql://"`. That message is less helpful than "DATABASE_URL is
// required", but acceptable since the application's own runtime guard
// (`src/core/config/env.ts`, validated by Zod at startup) is the
// authoritative env enforcement layer.
const databaseUrl = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
    // Prisma 7 removeu o flag `--shadow-database-url` do `migrate diff` — o
    // shadow DB agora vem daqui. Só é lido por `migrate dev` e
    // `migrate diff --from-migrations` (o guard de drift do CI); o
    // `migrate deploy` do boot em produção NÃO usa shadow. Fica atrás de
    // SHADOW_DATABASE_URL pra nunca transformar o banco de dev em shadow
    // (o shadow é resetado): sem a env, `migrate dev` mantém o shadow temporário
    // automático do Prisma.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
