# syntax=docker/dockerfile:1
# apps/api/Dockerfile — the ONE image definition for @pombo/api.
#
# Build context = the repo root (the API depends on the @pombo/shared-types
# workspace, consumed as its dist/). Stages:
#
#   base       manifests only → the yarn cache layer every other stage shares
#   deps       full install (dev + prod) — the toolchain for building/testing
#   build      shared-types → prisma generate → tsc (dist/ has no test code)
#   prod-deps  a second, production-only install (no devDependencies)
#   runtime    node:alpine + prod deps + dist/ + prisma migrations, non-root,
#              node as PID 1 (the entrypoint `exec`s it so SIGTERM reaches the
#              graceful shutdown), HEALTHCHECK on /healthz. Listens on API_PORT
#              (schema default 3333 — infra/app/docker-compose.prod.yml)
#   dev        `yarn dev` with the source bind-mounted (docker-compose.local.yml,
#              API_PORT=4444 from apps/api/.env)
#
#   docker build -f apps/api/Dockerfile --target runtime -t pombo-api .
#   docker build -f apps/api/Dockerfile --target dev     -t pombo-api:dev .
#
# CI stamps the version: --build-arg APP_VERSION=vX.Y --build-arg GIT_COMMIT=<sha>
# (both surface at GET /api/health; APP_VERSION is what `yarn deploy` verifies).

ARG NODE_IMAGE=node:22-alpine

# ── base ─────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
WORKDIR /usr/src/app
# Toolchain for native deps (bcrypt) + git for the lockfile entries resolved
# from a git URL. Do NOT --ignore-scripts: bcrypt's postinstall is what builds
# the binary.
RUN apk add --no-cache python3 make g++ git
COPY package.json yarn.lock tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
# The API's postinstall only runs `prisma generate` when the schema is present —
# it is not yet, so the install stays a pure dependency layer.
RUN yarn install --frozen-lockfile --network-timeout 100000

# ── build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared-types ./packages/shared-types
RUN yarn workspace @pombo/shared-types build
COPY apps/api ./apps/api
# `prisma generate` needs no database; the generated client is pure TypeScript
# and compiles into dist/ with the rest of the source.
RUN cd apps/api && yarn prisma generate && yarn build

# ── prod-deps ────────────────────────────────────────────────────────────────
FROM base AS prod-deps
RUN yarn install --frozen-lockfile --production --network-timeout 100000 \
  && yarn cache clean

# ── runtime ──────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /usr/src/app
# wget: the HEALTHCHECK below and the compose healthchecks.
RUN apk add --no-cache wget

ARG APP_VERSION=unknown
ARG GIT_COMMIT=unknown
ENV APP_VERSION=${APP_VERSION} GIT_COMMIT=${GIT_COMMIT}

# Production node_modules (root + the nohoisted prisma packages under apps/api),
# the built shared-types (the workspace symlink in node_modules points here),
# the compiled API and what `prisma migrate deploy` reads at boot.
COPY --from=prod-deps --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /usr/src/app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /usr/src/app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=build --chown=node:node /usr/src/app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build --chown=node:node /usr/src/app/apps/api/dist ./apps/api/dist
COPY --chown=node:node package.json ./
COPY --chown=node:node apps/api/package.json apps/api/prisma.config.ts ./apps/api/
COPY --chown=node:node apps/api/prisma ./apps/api/prisma
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint

WORKDIR /usr/src/app/apps/api
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${API_PORT:-3333}/healthz" || exit 1
ENTRYPOINT ["docker-entrypoint"]

# ── dev ──────────────────────────────────────────────────────────────────────
# docker-compose.local.yml bind-mounts ./apps/api over /usr/src/app/apps/api
# (keeping the image's node_modules in an anonymous volume), so the client is
# regenerated on every start — the host checkout may not carry src/generated.
FROM deps AS dev
ENV NODE_ENV=local
COPY packages/shared-types ./packages/shared-types
RUN yarn workspace @pombo/shared-types build
COPY apps/api ./apps/api
WORKDIR /usr/src/app/apps/api
EXPOSE 4444
CMD ["sh", "-c", "yarn prisma generate && yarn dev"]
