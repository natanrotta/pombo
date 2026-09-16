#!/bin/sh
# Container entrypoint for @pombo/api (see Dockerfile, `runtime` stage).
#
# 1. migrate-on-boot — `prisma migrate deploy` against DATABASE_URL. Correct
#    with ONE replica. Scaling to 2+ replicas turns this into a migration race:
#    set RUN_MIGRATIONS=false on the replicas and run the migration once as a
#    deploy step instead.
# 2. `exec node` — node becomes PID 1, so the orchestrator's SIGTERM reaches the
#    app's graceful shutdown (core/service/lifecycle) instead of dying in a
#    shell wrapper that never forwards signals.
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] prisma migrate deploy"
  node_modules/.bin/prisma migrate deploy
else
  echo "[entrypoint] RUN_MIGRATIONS=${RUN_MIGRATIONS} — skipping migrations"
fi

exec node dist/main.js "$@"
