# E2E Test Patterns — Pombo (`apps/web/e2e/`)

Authoritative source for Playwright end-to-end tests in this project. Specialists, agents and hooks defer to this file. Edits here ripple to `test-e2e.md`, `code-auditor.md`, `e2e-test-writer.md` and `post-edit-e2e.sh`.

> Companion docs: `frontend.md` (component/hook conventions), `BASELINE.md` (R1–R28 non-negotiables), `code-review-checklist.md` (anti-pattern codes — including the **E-** family below).

---

## Stack snapshot

| Layer | Tool | Where |
|---|---|---|
| Runner | `@playwright/test` v1.58+ | `apps/web/playwright.config.ts` |
| App under test | React 18 + Chakra UI 2.8 + React Router v6 + TanStack Query v5 | `apps/web/src/` |
| Web dev server | Vite on `:4000` (proxies `/api` → `:4444`) | `apps/web/vite.config.ts` |
| API | Express + Prisma on `:4444` (real backend, no mocks) | `apps/api/src/main.ts` |
| Database | Postgres seeded with the demo user (`demo@example.com` / `Demo1234!` — `e2e/fixtures/constants.ts` mirrors it) | `apps/api/prisma/seed.ts` |
| Auth | Session JWT in the httpOnly `pombo_at` cookie + `pombo_csrf` double-submit, seeded through the **API** (`apiClient.getSession()`) then persisted via `storageState` | `apps/web/e2e/global.setup.ts` |
| API client (test) | `fetch`-based, authenticated as the seed user | `apps/web/e2e/fixtures/api-client.ts` |
| Reports | HTML reporter, trace `on-first-retry`, screenshot `only-on-failure` | `playwright.config.ts` |
| i18n | `pt-BR` (default), `en`, `es` — assertions match both pt-BR **and** en | `apps/web/src/shared/i18n/locales/` |

**Single worker by design** — `playwright.config.ts` sets `workers: 1` and `fullyParallel: false`. Tests share `e2e/.auth/user.json` storage state and the same backend account. Do not flip this on a per-module basis — design tests assuming a serial execution model.

---

## Setup prerequisites (read before running anything)

The E2E suite is **fire-and-forget**: a single command brings up an
ephemeral stack (Postgres + Redis + API), runs the tests, and tears it all
down at the end. The dev backend (`yarn start`) is never touched — you can
keep developing on `:4000`/`:4444` while the E2E suite runs in parallel on
`:3001`/`:3334`.

```
                    Dev (yarn start)        E2E (yarn test:e2e)
Postgres            :5432                   :5433  (tmpfs / RAM, destroyed at end)
Redis               :6379                   :6380  (destroyed at end)
API                 :4444                   :3334  (spawned per run)
Web                 :4000                   :3001  (Vite proxies /api → :3334)
```

### One command for the full cycle

From `apps/web/`:

```bash
yarn test:e2e
```

Internally:
1. `docker compose -f docker-compose.e2e.yml down -v` — guarantee a virgin DB.
2. `docker compose up -d --wait` — fresh Postgres (tmpfs) + Redis.
3. `prisma migrate deploy` — apply all migrations.
4. `prisma/seed.ts` — populate the seed user (+ any demo data you add).
5. Spawn API on `:3334` (env merged from `apps/api/.env` + `apps/api/.env.e2e`).
6. Run `npx playwright test --project=chromium`. Playwright's `webServer`
   brings up Vite on `:3001` with `VITE_API_PROXY_TARGET=http://localhost:3334`.
7. Stop API. `docker compose down -v`. Exit with Playwright's status code.

### Iteration mode (skip the teardown)

When you're iterating on a single spec, paying ~30s for seed every run is
brutal. Use `:keep` variants:

```bash
yarn test:e2e:keep        # full cycle, then leave Docker + API up
yarn test:e2e:ui          # Playwright UI mode; implies :keep
yarn test:e2e:headed      # headed mode; implies :keep
```

Warm runs after `:keep` reuse the existing DB; the orchestrator detects the
seed user via a `psql` probe and skips re-seeding. Manual teardown:

```bash
yarn test:e2e:down        # docker compose down -v
```

### Where the env lives

- **`docker-compose.e2e.yml`** (repo root) — Postgres on `:5433` (tmpfs) + Redis on `:6380`.
- **`apps/api/.env.e2e`** — committed overrides on top of `apps/api/.env` (DB URL, port, origin, JWT secret). Inherits any third-party keys from the dev `.env` so you don't duplicate secrets.
- **`apps/web/scripts/e2e-run.ts`** — orchestrator. Reads both env files, merges, spawns API, runs Playwright, tears down.

### Reliability notes

- `prisma/seed.ts` schema drift breaks the cycle at step 4 — fix the seed
  to match the current schema.
- The api-client session cache (`apps/web/e2e/.auth/api-session.json`,
  anchored to the fixture file, never the cwd — it's a credential, keep it
  gitignored: `apps/web/e2e/.auth/` already is) probes
  `/auth/me` on load — if the cached JWT references a `userId` that no
  longer exists, the cache is invalidated and a fresh sign-in runs. So
  a stale cache from a previous DB can't break the next run.
- If the suite crashes mid-run leaving containers orphaned, the next
  `yarn test:e2e` always starts with `docker compose down -v`, so it
  self-heals.

---

## File layout

```
apps/web/
  playwright.config.ts                    # canonical config — do not duplicate per-project flags
  e2e/
    .auth/user.json                       # gitignored; written by global.setup; consumed by the `chromium` project
    global.setup.ts                       # runs preflight, logs in once, stores auth state
    fixtures/
      auth.fixture.ts                     # base `test` re-export (extensible; do not duplicate `test`/`expect`)
      preflight.ts                        # fail-fast env check (web up? API up? seed account?)
      api-client.ts                       # authenticated fetch client + per-module domain helpers
      test-data.ts                        # `createUniqueXxx()` factories, `uniqueName()` helper (create on first use)
    pages/                                # Page Objects — one class per routable page
      <Module>ListPage.ts
      <Module>DetailPage.ts
      components/                         # OPTIONAL — Page Objects for shared widgets (created when reused)
    tests/
      <module>/                           # one folder per module (mirrors apps/web/src/modules/)
        <module>-<flow>.spec.ts           # one flow per file — see "Naming"
```

**Reference today:** the suite ships a single `e2e/tests/auth.spec.ts` (UI sign-in from a signed-out context + an authenticated session reaching the protected shell) and no Page Objects yet — it is the template for the spec skeleton and the bilingual-assertion style. The first module suite (`devices` is the obvious candidate: register → QR modal → webhooks section → delete) creates `e2e/pages/DevicesListPage.ts` + `e2e/tests/devices/` following the layout above, and becomes the canonical reference from then on. The index route redirects to `/devices` (there is no `/dashboard`).

**Hard rules:**
- Never create a parallel `e2e/__tests__/`, `apps/web/__e2e__/`, or `cypress/` folder.
- Never co-locate `*.spec.ts` E2E specs inside `apps/web/src/` — those are reserved for Vitest unit tests (`patterns/frontend.md` § Testing).
- Specs run against the real backend (no request mocks). If a flow genuinely cannot run against the real backend (third-party redirects, etc.) discuss before adding a mock project — the default answer is "use a signed synthetic-webhook fixture or `api-client.ts` instead".

---

## Playwright config (reference)

The config defines three projects and one web server. The e2e-test-writer agent must understand which project a new spec belongs to before placing the file.

| Project | testDir | Auth | When to use |
|---|---|---|---|
| `setup` | `./e2e` (matches `global.setup.ts`) | n/a — writes auth | Implicit dependency of `chromium`. Never targeted directly. |
| `chromium` | `./e2e/tests` | `e2e/.auth/user.json` | Default project. Real backend. **All module specs go here.** |

The single `webServer` entry spawns a **dedicated E2E Vite on `:3001`** (`VITE_PORT=3001 VITE_API_PROXY_TARGET=http://localhost:3334 yarn dev`, with `reuseExistingServer: false` — `scripts/e2e-run.ts` sweeps the port first). It is fully isolated from the dev pair on `:3000/:3333`, including the dep-optimizer cache: `vite.config.ts` gives the E2E instance its own `cacheDir` (`node_modules/.vite-e2e`) so its optimizer runs never rewrite the dev server's `node_modules/.vite/deps`. Never point a webServer at `:3000`. If you ever need an isolated project for a mock-based flow, add a project + webServer block but justify it in the PR.

---

## The 5 selector rules (Playwright + Chakra)

1. **`getByRole(...)` first.** Use the ARIA role + accessible name. Chakra exposes the right roles for all interactive primitives.
2. **`getByLabel(...)` for form fields.** Chakra `<FormControl>` wires `<FormLabel>` → input via `aria-labelledby`. The label text in the regex must match pt-BR **and** en (see "Bilingual assertions").
3. **`getByText(...)` for static content / empty states / toasts.** Prefer over text-on-element + locator chains.
4. **`getByPlaceholder(...)` only when the input has no label** (search bars, inline filters).
5. **`getByTestId(...)` as last resort.** If you reach for this, first try: parent role + `.filter({ hasText: ... })`, or `getByRole(role).getByText(name)`. Add a `data-testid` to the source component only when no semantic option exists and document the reason in the POM.

**Forbidden:**
- CSS class selectors (`.chakra-button`, `.css-xyz`, `[class*="..."]`) → `E-C1` / `F-H17`.
- XPath.
- `nth(0)` / `first()` / `last()` to "fix" ambiguity — fix the locator instead (`.filter({ has: ... })`) → `E-H2`.
- Auto-generated ids (`#chakra-modal--header-...`).

**Chakra-specific cheat sheet:**
| Element | Locator |
|---|---|
| Button | `getByRole("button", { name: /salvar\|save/i })` |
| Input / Textarea via `FormControl` | `getByRole("textbox", { name: /nome\|name/i })` or `getByLabel(/nome\|name/i)` |
| Select | `getByRole("combobox", { name: /.../ })` |
| Modal | `getByRole("dialog")` |
| Confirm/Alert dialog | `getByRole("alertdialog")` |
| Tab | `getByRole("tab", { name: /.../ })` |
| Toast / success message | `getByText(/criado com sucesso\|created successfully/i)` (Chakra toasts have inconsistent roles) |
| Menu item | `getByRole("menuitem", { name: /.../ })` |
| Heading (page title) | `getByRole("heading", { name: /dispositivos\|devices/i, level: 1 })` |
| Card row in a list | `page.getByRole("group").filter({ has: page.getByRole("button", { name: /ações\|actions/i }) })` |

---

## Page Object Model — Pombo style

POMs are **stateless**: they only expose locators + action methods. No remembered counts, no internal state. The spec orchestrates the flow.

### Skeleton

```ts
// e2e/pages/<Module>ListPage.ts
import { type Page, type Locator, expect } from "@playwright/test";

export class <Module>ListPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly searchInput: Locator;
  readonly emptyState: Locator;
  readonly noResultsState: Locator;
  readonly itemCards: Locator;

  readonly modal: Locator;
  readonly modalSubmitButton: Locator;
  readonly modalCancelButton: Locator;
  readonly confirmDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly confirmCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole("heading", { name: /<pt>|<en>/i, level: 1 });
    this.searchInput = page.getByPlaceholder(/buscar|search/i);
    this.emptyState = page.getByText(/nenhum item|no items found/i);
    this.noResultsState = page.getByText(/nenhum resultado|no results/i);
    this.itemCards = page
      .getByRole("group")
      .filter({ has: page.getByRole("button", { name: /ações|actions/i }) });

    this.modal = page.getByRole("dialog");
    this.modalSubmitButton = this.modal.getByRole("button", { name: /criar|create/i });
    this.modalCancelButton = this.modal.getByRole("button", { name: /cancelar|cancel/i });
    this.confirmDialog = page.getByRole("alertdialog");
    this.confirmDeleteButton = this.confirmDialog.getByRole("button", { name: /excluir|delete/i });
    this.confirmCancelButton = this.confirmDialog.getByRole("button", { name: /cancelar|cancel/i });
  }

  async goto() { await this.page.goto("/<route>"); }                        // do not call waitForLoadState here — see below
  async search(term: string) { /* fill + 500ms debounce wait */ }
  async clickAdd() { /* opens modal */ }
  async fill<X>Form(data: ...) { /* atomic field fills */ }
  async submit<X>Form() { /* clicks submit */ }
  async create<X>(data: ...) { /* convenience: clickAdd → fill → submit → assert modal closed */ }
  async delete<X>FromList(name: string) { /* hover card → menu → delete → confirm */ }
  async expect<X>Visible(name: string) { /* expect getByText().first().toBeVisible() */ }
  async expect<X>NotVisible(name: string) { /* expect not.toBeVisible() */ }
}
```

**Don'ts:**
- No `doFullCrud()` god-methods — keep methods atomic. → `E-H3`
- No `async login()` inside a list POM — that's `global.setup.ts`'s job.
- No raw selector strings stored as fields (`'.chakra-modal'`) — always `Locator` instances built with semantic queries. → `E-C1`
- No imports from `apps/web/src/**` **except** for type-only imports of domain entities in mocks fixtures. → `E-H6`

### Component POM

Reusable widgets (Sidebar, ConfirmDialog, FilterBar) live in `e2e/pages/components/` and are composed by page POMs as fields (`this.sidebar = new Sidebar(page)`).

---

## Fixtures

### Authentication — already wired

There is **one** auth path: `global.setup.ts` runs the preflight, calls `apiClient.getSession()` (API sign-in as `demo@example.com`), seeds the `pombo_at` + `pombo_csrf` cookies and the language key, and writes `e2e/.auth/user.json`. The `chromium` project consumes that file via `storageState`. It goes through the API on purpose — the UI sign-in races the cookie write against navigation and produced flaky signed-out specs. Every spec inherits an authenticated page — **do not** re-login in `beforeEach`. → `E-C2`

If a test needs an **unauthenticated** page (sign-in flows, public routes), use a fresh context:

```ts
test("public route does not require auth", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  // ...
  await ctx.close();
});
```

### Test data — `fixtures/test-data.ts`

- `uniqueName(prefix)` — `${prefix} ${Date.now()}` for any unique label.
- `TEST_<ENTITY>` — frozen reference data when uniqueness doesn't matter (rare in this project — prefer unique).
- `createUnique<Entity>()` — returns a full object with timestamp-suffixed name/email and stable shape.

Add new factories here when a new module ships; never inline test data in the spec when more than one test needs it. → `E-M1`

### API client — `fixtures/api-client.ts`

Authenticated REST client over `fetch`. Signs in once with the seed user (`demo@example.com`), caches the JWT for the suite, and exposes `apiClient.{get,post,put,patch,delete}` plus per-module helpers (`deviceApi.create()`, etc.). Add a new helper block when a module ships its first spec that needs API-side setup.

**Use it when:**
- A spec needs an existing entity to assert against (search results, list with ≥N items, edit/delete tests) and creating one through the UI would just slow the suite down.
- `afterEach` cleanup needs a hard guarantee (the UI-driven cleanup loop tried but the modal got stuck).
- Setting up cross-module fixtures the UI can't easily build (a state the seed user can't represent).

**Don't use it when:**
- The UI flow IS the thing under test. `device-register.spec.ts` exercises the modal — never replace its first `registerDevice()` UI call with `deviceApi.create()`, you'd be testing the wrong contract.

```ts
import { deviceApi } from "../../fixtures/api-client";

// Seed: 5 rows so the search test has results to filter.
const seeded = await Promise.all(
  Array.from({ length: 5 }, (_, i) => deviceApi.create({ name: `Seed ${i}` }))
);
test.afterEach(async () => {
  for (const d of seeded) await deviceApi.delete(d.id).catch(() => {});
});
```

Mocks (`page.route(...)`) are **not** part of the current model — re-introduce that pattern only when no real-backend path exists, and document the reason in the PR.

---

## Test structure

### Naming

```
e2e/tests/<module>/<entity>-<flow>.spec.ts
```

- `<module>`: matches `apps/web/src/modules/<module>/` (`auth`, `devices`, `messaging`, `account`, `settings`). For a module with multiple entities, still split by entity.
- `<entity>`: singular (`device`, `message`, `api-token`, `profile`, ...).
- `<flow>`: one of `create`, `list`, `search`, `edit`, `delete`, `detail`, etc. **One flow per file** — never bundle `create + edit + delete` into one spec. → `E-H4`

Examples:
```
e2e/tests/auth/sign-in.spec.ts
e2e/tests/devices/device-register.spec.ts
e2e/tests/devices/device-webhooks-edit.spec.ts
e2e/tests/messaging/message-send.spec.ts
```

### Spec skeleton

```ts
import { test, expect } from "../../fixtures/auth.fixture";
import { <Module>ListPage } from "../../pages/<Module>ListPage";
import { createUnique<Entity> } from "../../fixtures/test-data";

test.describe("<Entity> <Flow>", () => {
  let listPage: <Module>ListPage;
  let createdNames: string[] = [];

  test.beforeEach(async ({ page }) => {
    listPage = new <Module>ListPage(page);
    await listPage.goto();
  });

  test.afterEach(async ({ page }) => {
    try {
      const cleanup = new <Module>ListPage(page);
      await cleanup.goto();
      for (const name of createdNames) {
        await cleanup.search(name);
        const card = cleanup.itemCards.filter({ hasText: name }).first();
        if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cleanup.deleteFromList(name);
          await page.waitForLoadState("networkidle");
        }
        await cleanup.clearSearch();
      }
      createdNames = [];
    } catch {
      // Best-effort cleanup — never let cleanup fail the test
    }
  });

  test("happy path — minimum required fields", async () => { /* ... */ });
  test("happy path — all fields", async () => { /* ... */ });
  test("shows success toast on create", async ({ page }) => { /* ... */ });
  test("closes modal without saving on cancel", async () => { /* ... */ });

  // ── Negative path ──────────────────────────────────────────
  test("rejects empty name", async ({ page }) => { /* ... */ });
  test("rejects whitespace-only name", async ({ page }) => { /* ... */ });
  test("resets form after previous submission", async () => { /* ... */ });
});
```

**Mandatory pieces:**
- `test.describe` per file, named after the flow (`"Device Registration"`, `"Profile Edit"`).
- Best-effort cleanup in `afterEach` wrapped in `try/catch` — never fail a test on cleanup. → `E-H5`
- A `// ── Negative path ──` divider comment when negative tests follow positive ones (mirrors existing specs).
- Bilingual regex on every user-facing assertion (`/criado|created/i`).

### Coverage rubric — what counts as "module covered"

When the user says "cover the X module" or "/test-e2e cobre o módulo X", the agent must produce at least these flows (skip a flow only if the UI does not support it, and explain why in the agent report):

| Flow file | What it covers (minimum) |
|---|---|
| `<entity>-list.spec.ts` | Page renders title, empty state when no data, paginated state when many, pagination next/prev. |
| `<entity>-create.spec.ts` | Happy path (min fields), happy path (all fields), success toast, cancel doesn't persist, empty name rejected, whitespace-only rejected, modal reopens empty after success. |
| `<entity>-search.spec.ts` | Search filters results, clearSearch restores, no-results state, search persists across pagination if applicable. |
| `<entity>-edit.spec.ts` (if entity supports edit) | Happy path, validation on empty required, cancel doesn't persist, auto-save (if `useDetailPageController`) — verify dirty → wait debounce → toast. |
| `<entity>-delete.spec.ts` | Confirm dialog appears, confirm deletes, cancel keeps item, item disappears from list. |
| `<entity>-detail.spec.ts` (if entity has a detail route) | Loads from list, displays fields, breadcrumb back navigates correctly. |

Each flow file must also include at least **one negative test** (rejection / validation / error toast). Specs without a negative test are flagged `E-M2`.

---

## Database CRUD — the test interaction model

E2E specs touch Postgres **only through the running API**. There is no direct Prisma access from specs and no "test database" reset between specs. The model is:

1. **UI-first.** When the user-visible flow is what's being verified, drive it through the page object. Need an entity to exist for an edit test? Prefer the UI action method when creation is what's under test.
2. **API helpers for non-assertion setup.** When the spec needs an entity to exist but its creation is not under test, call `apiClient` (see Fixtures § API client). Faster, deterministic, and contractually identical to the UI path (both go through the same controller → use case).
3. **Cleanup is best-effort, never blocking.** The `afterEach` loop searches + deletes each `createdNames[]` entry via the UI; failures are swallowed (`E-H5`). If you need a hard guarantee, do the cleanup via `apiClient.delete()` inside `try/catch`.
4. **State leaks across specs.** Because workers=1 and there's no DB reset, an entity created in one spec will exist when the next spec runs unless cleanup succeeded. Always use `createUnique<Entity>()` factories so collisions don't bite, and treat the seed (`yarn seed`) as the only stable baseline.
5. **The seed is your reference data.** `apps/api/prisma/seed.ts` provisions the demo account + user (`demo@example.com`) plus any demo data you add. Treat existing seeded rows as fixtures you can read but should not modify or delete from a test.

**When you need a fresh account** (a state the seed user can't represent): use `apiClient.post("/auth/sign-up", ...)`, then `apiClient.signIn()` with the new credentials, then teardown via `apiClient.delete(...)`. Document the rationale in the spec — most flows are achievable on the seed user.

---

## Webhooks — signed synthetic events

If you add an inbound webhook (payments, etc.), it should verify an HMAC signature against a secret before parsing the body — so a naive `fetch` from a test fails with `400 Invalid signature`. The pattern for testing it: a small fixture that builds and signs a synthetic event and POSTs it to the webhook route, letting you assert the side-effect afterwards (via the UI or `apiClient`).

Keep the synthetic `data.object` payload minimal — only the fields the receiving use-case reads. Over-specifying makes the test brittle to upstream schema changes the receiver doesn't care about. Prefer this over driving a vendor CLI (`... listen --forward-to`) from inside the test or calling internal use-cases directly.

---

## Waits — what's allowed, what's not

Playwright auto-waits on locator assertions. The most reliable pattern is:

```ts
await expect(modal).not.toBeVisible({ timeout: 10000 });
```

**Allowed waits:**
1. `expect(locator).toBeVisible({ timeout })` / `not.toBeVisible({ timeout })` — primary tool.
2. `page.waitForURL("**/dashboard", { timeout: 15000 })` — after navigation.
3. `page.waitForLoadState("networkidle")` — **legacy in this project**; tolerated only because TanStack Query background refetches confuse simpler waits in lists with infinite scroll. New POMs should prefer `expect(itemCards.first()).toBeVisible()` and add `networkidle` only when a real race is observed. Document the reason in a code comment when you keep it. → `E-M3`
4. `page.waitForTimeout(<n>)` — **only** for two project-tolerated cases:
   - **`500`** — search debounce. The dominant pattern (`waitForTimeout(500)` after `search()`). Source of truth: `apps/web/src/shared/hooks/useDebouncedValue.ts` (verify the value before changing the test convention). → `E-C3` if any other value appears in a fresh search-debounce context.
   - **`300`** — popover/animation settle after a Chakra popover/modal closes. Must come with a one-line comment explaining the race (the hook does not enforce that, the reviewer does). → `E-M3` if introduced without the comment.

   Any other value (`200`, `1000`, `1700`, `2000`...) is forbidden in new code. → `E-C3`

**Forbidden:**
- Hard sleeps anywhere except documented debounce/throttle delays.
- `await page.waitFor(...)` (deprecated API surface).
- Manual polling loops (`for (let i = 0; i < 10; i++) { await page.wait... }`).
- Waiting on console messages / network responses to "know when the API finished" instead of asserting on visible UI state.

---

## Bilingual assertions (i18n)

This project ships in `pt-BR` (default), `en`, and `es`. Every assertion on user-visible text must accept at least pt-BR and en:

```ts
await expect(page.getByText(/criado com sucesso|created successfully/i)).toBeVisible();
await expect(page.getByRole("button", { name: /salvar|save/i })).toBeEnabled();
```

`es` is not asserted because the default auth user uses pt-BR; CI does not switch locales. If a future test toggles the locale, extend regexes to three.

**Hard rule:** never assert against a single language — even when the storage state is fixed, marketing/legal can flip the default. → `E-H1`

---

## Anti-pattern codes (the **E-** family)

These codes live in `code-review-checklist.md` and are surfaced by `code-auditor` and `post-edit-e2e.sh`.

| Code | Severity | What |
|---|---|---|
| `E-C1` | Critical | CSS class / XPath / generated-id selector (also `F-H17`). |
| `E-C2` | Critical | Manual login inside a spec (must rely on `global.setup.ts` storage state). |
| `E-C3` | Critical | `page.waitForTimeout(...)` outside the 500ms-debounce convention. |
| `E-C4` | Critical | Hardcoded production credentials, secrets, real PII in fixtures. |
| `E-H1` | High | Assertion in a single language (no `pt|en` alternation). |
| `E-H2` | High | `nth(...)`, `first()`, `last()` used to disambiguate a brittle locator instead of `.filter({ has: ... })`. |
| `E-H3` | High | Page Object god-method (a single method that drives multiple unrelated flows). |
| `E-H4` | High | Multiple unrelated flows (`create + delete + edit`) bundled in one spec file. |
| `E-H5` | High | Cleanup not wrapped in `try/catch` — cleanup failures fail the test. |
| `E-H6` | High | POM importing concrete code from `apps/web/src/**` (allowed: type-only imports in `fixtures/*.mocks.ts`). |
| `E-H7` | High | Spec re-implements the same locator already declared on the POM (duplication that drifts when the UI changes). |
| `E-M1` | Medium | Inline test data when ≥2 tests need it (should be in `fixtures/test-data.ts`). |
| `E-M2` | Medium | Flow file with no negative-path test. |
| `E-M3` | Medium | New `waitForLoadState("networkidle")` without a comment explaining the specific race. |
| `E-M4` | Medium | `data-testid` selector added without first trying role/label/text. |
| `E-L1` | Low | `describe` title doesn't match the flow file name. |
| `E-L2` | Low | Bilingual regex missing `i` flag. |

---

## Running tests

```bash
# Inside apps/web/
yarn test:e2e                          # all chromium specs (default project)
yarn test:e2e:ui                       # UI mode — fastest for authoring
yarn test:e2e:headed                   # see the browser
yarn test:e2e:report                   # open last HTML report
npx playwright test e2e/tests/devices  # narrow by folder
npx playwright test device-register    # narrow by filename grep
npx playwright test -g "happy path"    # narrow by test title grep
```

When iterating, prefer `--ui` — it gives you the locator picker, time-travel, and a watch loop.

---

## Self-learning hook

Per `.claude/learning/protocol.md`, after authoring or fixing specs the `/test-e2e` skill and `e2e-test-writer` agent must update `.claude/knowledge/test-e2e.md` with **new wisdom only**. Sections to maintain:

- `Consolidated Principles` — facts that proved durable across runs.
- `Selector Strategies` — the right locator for a particular Chakra wart.
- `Flaky Test Fixes` — concrete race conditions encountered and how they were stabilized.
- `Page Object Patterns` — composition tricks (popover scoping, infinite-scroll filtering, etc.).
- `Dead Ends` — approaches that looked promising but failed; with the reason.

Don't restate this file in the knowledge file. Wisdom complements patterns; it doesn't shadow them.
