# Bugsnag / Observability — Knowledge (living runbook)

> Living notes for the `/bugsnag` skill + `bugsnag-analyst` agent: the **confirmed** project→key map, the runbook
> (how to fix prod, how to call the API, what to create in the UI), and the gotchas discovered with use.
> Starts mostly empty and fills **with use**, per `.claude/learning/protocol.md`. Each entry: `[tag] [date] [severity]`.
> Authority for the model + `BS-*` catalog stays in `.claude/patterns/bugsnag.md`.

## Project → key map

Fill this from `.claude/scripts/bugsnag/bugsnag.sh projects` on first use (and `whoami` for the org id/slug → also
`BUGSNAG_ORG_SLUG` in `.claude/.secrets/bugsnag.env`). The rows below are the **expected shape** (one project per
app per environment), not confirmed facts — replace every `(confirm via bugsnag.sh projects)` with the real value and
date-stamp the header. Never guess a key.

| Project | id | type | notifier api_key | stage | stability target |
|---|---|---|---|---|---|
| Pombo API PROD | (confirm via bugsnag.sh projects) | express | (confirm via bugsnag.sh projects) | production | (confirm via bugsnag.sh projects) |
| Pombo Web PROD | (confirm via bugsnag.sh projects) | react | (confirm via bugsnag.sh projects) | production | (confirm via bugsnag.sh projects) |
| Pombo API LOCAL | (confirm via bugsnag.sh projects) | express | (confirm via bugsnag.sh projects) | local | (confirm via bugsnag.sh projects) |
| Pombo Web (dev) | (confirm via bugsnag.sh projects) | react | (confirm via bugsnag.sh projects) | development | (confirm via bugsnag.sh projects) |

Org: `(confirm via bugsnag.sh whoami)`. Once confirmed, also record **where each notifier key is committed** (the API
prod key belongs in `infra/.env.prod` on the app host + a placeholder line in `infra/.env.prod.example`; the web prod
key in the static host's build env or a committed `apps/web/.env.production`) so a key rotation knows every copy.

## Runbook — "prod not reporting"

Symptom: `bugsnag.sh projects` shows the API prod project with `⚠ no events yet` (`release_stages: []`) while the app
is up. The API reporter is **fail-open** (no `BUGSNAG_API_KEY` ⇒ silent no-op), so this is almost always operational,
not a code bug. Needs app-host access — out of band for the assistant; pair with `/devops`.

1. **Confirm live** — `bugsnag.sh projects` / `bugsnag.sh monitor`. Then `make logs`: a prod boot without the key logs
   `BUGSNAG_API_KEY not configured - error tracking disabled` at **WARN**; a good boot logs `Bugsnag initialized`.
2. **Set the key on the app host** — in `infra/.env.prod` (`/opt/pombo/app/infra/.env.prod`, `chmod 600`) add
   `BUGSNAG_API_KEY=<Pombo API PROD notifier key from bugsnag.sh projects>`. If you recreate the file instead of
   editing it, the `ghrunner` read grant is lost — re-run `make runner-setup` (see `infra/RUNBOOK.md`). Add the
   same placeholder line (blank) to `infra/.env.prod.example` under `Observability` so it stays documented.
3. **Recreate the API container** so `env_file` is re-read (a restart is not enough for a new env var):
   `make deploy-direct TAG=<live version>` from your machine, or on the host
   `cd /opt/pombo/app/infra/app && docker compose -f docker-compose.prod.yml up -d --force-recreate api`
   (re-shipping the live tag via `yarn deploy` also works). Then `yarn monitor-status` → API online, same version.
4. **Force one event** to confirm the pipe — any authed 5xx, or a one-off
   `errorReporter.notify(new Error("bugsnag prod smoke"))` behind a temporary guarded debug route (remove after).
5. **Verify from anywhere** — `bugsnag.sh projects` → the prod project shows `['production']`; `bugsnag.sh monitor`
   flips it to `RECEIVING`; `bugsnag.sh stability <project>` starts populating (the express `requestHandler` opens a
   session per request).

Web prod not reporting: same check on the web prod project; the key is build-time (`VITE_BUGSNAG_API_KEY`), so fix
the static host's build env (or `apps/web/.env.production`) and redeploy the frontend — no container involved.

## Data Access API recipes

- Prefer the CLI: `bugsnag.sh {whoami,projects,errors,error,trends,stability,monitor,raw}` — it sets
  `Authorization: token …` + `X-Version: 2`, uses `--globoff` + `-G --data-urlencode` for the `filters[...]` syntax,
  and never puts the token on the command line. Endpoint list: `.claude/patterns/bugsnag.md` §7.
- Full event for an incident: `bugsnag.sh raw "/projects/<project-id>/errors/<errorId>/latest_event"` (breadcrumbs,
  `metaData.error|request|queue|react`, `app.version`). Never echo phone numbers, JIDs, or message text from it.
- Empty ≠ broken: `errors` returns `[]` on a healthy inbox; `stability_trend` returns 204 with no sessions.

## Saved searches (UI)

- (none yet) — create in app.bugsnag.com → project → Inbox → save filter; document name + filter string here.

## Gotchas

- (none yet)
