# @pombo/web

The Pombo dashboard — a React + Vite single-page app with a **sidebar shell** where an account manages its WhatsApp devices, tests sends and gets its public-API token.

**Stack:** React 19 · Vite 5 · TypeScript · Chakra UI 3 (semantic tokens, light/dark via `next-themes`) · TanStack Query 5 · react-hook-form + Zod · react-i18next (en/pt-BR/es) · Vitest (unit) · Playwright (e2e). Conventions: [`.claude/patterns/frontend.md`](../../.claude/patterns/frontend.md).

---

## Structure

```
apps/web/src
├── app/
│   ├── App.tsx                 # root providers
│   ├── router/                 # AppRouter, RoutePaths, guards, lazyWithRetry
│   ├── providers/              # app-wide context providers
│   └── theme/                  # Chakra v3 system (foundations + semantic tokens)
├── core/
│   ├── di/                     # repositories DI (repository ← hook ← page)
│   ├── http/                   # axios httpClient (/api, cookies + CSRF)
│   ├── query/                  # QueryClient, query keys, stale times, error handler
│   └── errors/                 # AppError + error codes
├── modules/                    # one folder per capability — see modules/README.md
│   ├── auth/                   # sign-in, register, forgot/reset password, verify e-mail
│   ├── devices/                # device list + detail (connect/QR, groups, webhooks)
│   ├── messaging/              # send sandbox
│   ├── account/                # public-API token page
│   └── settings/               # profile page
└── shared/
    ├── components/             # layout (AppShell/sidebar), ui, forms, icons, skeletons, animations
    ├── hooks/ · contexts/      # generic hooks + sidebar context
    ├── i18n/                   # react-i18next setup + locales/{en,pt-BR,es}
    └── constants/ · lib/ · types/ · utils/ · appVersion.ts
```

Path aliases: `@`, `@/app`, `@/core`, `@/shared`, `@/modules`, `@assets`.

## Routing

Public: `/sign-in`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`.
Authenticated (inside `AppShell` + `ProtectedRoute`): `/devices`, `/devices/:id`, `/sandbox`, `/perfil`, `/api` — `/` redirects to `/devices`, `/settings` to `/perfil`, plus a `404` fallback. Guards: `ProtectedRoute`, `PublicOnlyRoute`.

## Data flow

`httpClient` (axios) calls `/api/*`, which the Vite dev server proxies to the API on `:4444`. Data access goes through **DI repositories** (`core/di`) consumed by TanStack Query hooks in each module — `repository → hook → page`.

## Environment

All variables are optional locally (copy `.env.example` to `.env`). They are public — they ship in the bundle.

| Var | Purpose |
|---|---|
| `VITE_API_URL` | API base including `/api`. Empty → the Vite `/api` proxy (localhost:4444). |
| `VITE_GOOGLE_CLIENT_ID` | Enables "Sign in with Google" (must match the API's `GOOGLE_CLIENT_ID`). |
| `VITE_BUGSNAG_API_KEY` | Browser error reporting. Empty → disabled. |
| `VITE_APP_VERSION` | Version stamp in the sidebar. Unset → `CF_PAGES_COMMIT_SHA` → git short SHA (build) → `dev`. |

## Commands

From the repo root:

```bash
yarn web:up        # dev server on http://localhost:4000 (HMR)
yarn build:web     # production build + dist/version.json
```

Inside the workspace (`apps/web`):

```bash
yarn dev           # vite dev (:4000)
yarn build         # tsc + vite build
yarn test          # Vitest unit tests
yarn test:e2e      # Playwright — boots its own stack (Postgres :5433, Redis :6380, API :3334, web :3001)
```

> The API must be running (`yarn backend:up-d`) for authenticated flows. Demo login: `demo@example.com` / `Demo1234!`.

## Deploy

A static build on a CDN / static host (e.g. Cloudflare Pages), deployed on push to `main`. Build command: `yarn build:web`; output: `apps/web/dist`. The generated `dist/version.json` is what `yarn monitor-status` reads to show the live commit. See [`DEPLOY.md`](../../DEPLOY.md).

## Testing

- **Unit:** Vitest, co-located `*.spec.{ts,tsx}`.
- **E2E:** Playwright in `apps/web/e2e` (fixtures + api client + specs), orchestrated by `scripts/e2e-run.ts`. Conventions: [`.claude/patterns/e2e.md`](../../.claude/patterns/e2e.md). The HTML report lands in `.playwright/` (git-ignored) — `yarn test:e2e:report`.
