# @pombo/web

The Pombo dashboard — a React + Vite single-page app where an account manages its WhatsApp devices, tries sends in a sandbox, and manages its public API token.

**Design system:** `@pombo/theme` (`packages/theme`) — tokens, semantic tokens, text styles and recipes. The app only composes it.

**Stack:** React 19 · Vite 5 · TypeScript (strict) · Chakra UI v3 (+ `next-themes`) · TanStack Query 5 · axios · react-hook-form + Zod · react-i18next (pt-BR / en / es) · lucide-react · Bugsnag · Vitest (unit) · Playwright (e2e).

The rebuild plan for this app lives in [`docs/web-rebuild/roadmap.md`](../../docs/web-rebuild/roadmap.md).

---

## Structure

```
apps/web
├── aliases.ts                  # the one path-alias map (vite + vitest)
├── assets/                     # bundled assets (imported via @assets)
├── public/                     # static files served as-is — pombo-icon.svg is also
│                               #   linked by the API's transactional e-mails
├── e2e/                        # Playwright: global.setup, fixtures, page objects (pages/), specs + visual baselines (tests/)
└── src
    ├── main.tsx                # error reporter + stale-chunk listener + i18n → <App/>
    ├── app/
    │   ├── App.tsx             # GlobalErrorBoundary → AppProviders → SidebarProvider → AppRouter
    │   ├── providers/          # Chakra (next-themes) · Toaster · QueryClient · Google OAuth · Auth
    │   ├── router/             # AppRouter, RoutePaths, guards, lazyWithRetry, NotFoundPage
    │   └── theme/              # createSystem(defaultConfig, pomboThemeConfig, globalCss) + token contract spec
    ├── components/ui/          # Chakra v3 snippets — the only place compound components are assembled
    ├── core/
    │   ├── di/                 # repository singletons (page → hook → repository → httpClient)
    │   ├── errors/             # AppError + the error codes the UI branches on
    │   ├── http/               # axios client: cookies, CSRF, envelope unwrap, silent refresh
    │   └── query/              # queryClient, queryKeys, stale-time tiers
    ├── modules/                # domain/ · infrastructure/ · presentation/ per module
    │   ├── auth/               # sign-in, register, verify e-mail, forgot/reset password, AuthContext
    │   ├── devices/            # list, detail, create, QR pairing, webhooks (canonical module)
    │   ├── messaging/          # sandbox: send text/group/media, live status queue
    │   ├── account/            # public API token + Postman collection
    │   └── settings/           # profile (name, avatar, language, color mode)
    ├── shared/
    │   ├── components/         # layout (shell, sidebar, bottom nav) · ui · forms · skeletons · icons · animations
    │   ├── hooks/ contexts/    # useDetailPageController, useFormState, useNotify, useConfirm, ... · Sidebar
    │   ├── i18n/               # react-i18next + locales/{pt-BR,en,es}/{common,auth,settings,devices,sandbox}.json
    │   └── constants/ lib/ types/ utils/
    └── test/                   # Vitest setup + renderWithProviders
```

Path aliases: `@/*` → `src/*`, `@assets/*` → `assets/*`.

## Routing

| Path | Page | Guard |
|---|---|---|
| `/sign-in`, `/register`, `/forgot-password` | auth pages | `PublicOnlyRoute` |
| `/verify-email` | e-mail PIN (scoped token, no session yet) | none |
| `/reset-password?token=` | new password — **the API's reset e-mail links here** | none |
| `/devices`, `/devices/:id` | device list / detail | `ProtectedRoute` + `AppShell` |
| `/sandbox` | send sandbox | `ProtectedRoute` + `AppShell` |
| `/perfil` | profile (`/settings` redirects here) | `ProtectedRoute` + `AppShell` |
| `/api` | API token | `ProtectedRoute` + `AppShell` |
| `/404`, `*` | not found | `ProtectedRoute` + `AppShell` |
| `/dev/styleguide` | design-system gallery — **dev server only**, never in a production build | `ProtectedRoute` + `AppShell` |

Paths live only in `src/app/router/RoutePaths.ts`.

## Data flow & auth

- `httpClient` (axios, `withCredentials`) calls `/api/*`; the Vite dev server proxies it to the API on `:4444`. Pages never call it: **page → module hook (TanStack Query) → `core/di` repository → `httpClient`**.
- The session JWT rides the httpOnly `pombo_at` cookie and is never read by JS. The client echoes the `pombo_csrf` cookie as `X-CSRF-Token`, unwraps `{ ok, data }`, and refreshes silently on `AUTH_TOKEN_EXPIRED | INVALID | REVOKED | AUTH_NO_TOKEN` only.
- During sign-up the API issues a scoped `email:verify` token; it lives in `sessionStorage` and is sent only to `/auth/email-verification/*`.
- Every session end (sign-out or expiry) clears the query cache and every `@pombo-web:*` storage key except the device preferences (language, sidebar).
- There is no realtime transport: QR pairing polls every 3 s, sandbox message status every 2 s.

## Environment

All variables are optional locally (copy `.env.example` to `.env`). They are public — they ship in the bundle.

| Var | Purpose |
|---|---|
| `VITE_API_URL` | API base, **including** `/api` (e.g. `https://api.example.com/api`). Empty → the Vite `/api` proxy. |
| `VITE_GOOGLE_CLIENT_ID` | Enables "Sign in with Google" (must match the API's `GOOGLE_CLIENT_ID`). |
| `VITE_BUGSNAG_API_KEY` | Error + performance reporting. Empty → disabled. |
| `VITE_APP_VERSION` | Build-time version stamp (falls back to the Pages commit SHA, then `git`, then `dev`). |

## Commands

From the repo root:

```bash
yarn web:up        # dev server on http://localhost:4000 (HMR)
yarn build:web     # production build + dist/version.json
```

Inside `apps/web`:

```bash
yarn dev           # vite dev (:4000)
yarn build         # tsc + vite build
yarn test          # Vitest unit tests
yarn test:e2e      # Playwright — boots its own stack (Postgres :5433, Redis :6380, API :3334, web :3001)
yarn test:e2e --update-snapshots   # accept an intended visual change (gallery + screen baselines)
```

> Authenticated flows need the API (`yarn backend:up-d`). Seeded login: `demo@example.com` / `Demo1234!`.

## Deploy

A static build on a CDN / static host (Cloudflare Pages), deployed on push to `main`. Build command: `yarn build:web`; output: `apps/web/dist`. The generated `dist/version.json` (commit, branch, build time) is what `yarn monitor-status` reads to show the live commit. See [`DEPLOY.md`](../../DEPLOY.md).

## Testing

- **Unit:** Vitest, co-located `*.spec.{ts,tsx}`.
- **E2E:** Playwright in `apps/web/e2e` (fixtures + api client + page objects + specs), orchestrated by `scripts/e2e-run.ts`. Visual baselines (the `/dev/styleguide` gallery and the app screens, light and dark) live in `e2e/tests/__screenshots__/` and are compared on macOS only. Conventions: [`.claude/patterns/e2e.md`](../../.claude/patterns/e2e.md). The HTML report lands in `.playwright/` (git-ignored) — `yarn test:e2e:report`.
