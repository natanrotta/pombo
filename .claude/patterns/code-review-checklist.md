# Code Review Checklist — Project Anti-Patterns (Authority)

**This document is the authoritative checklist for `/code-review` and any reviewer (human or AI) on this codebase.** It is project-specific. Generic OWASP / clean-code lists complement it but never replace it.

For full architectural context, see `.claude/patterns/backend.md` and `.claude/patterns/frontend.md`. For the task-contract rules behind the `SC-*` family, see `.claude/patterns/spec.md`.

---

## How to Use

1. For each file in the diff, walk through the relevant section below (Backend / Frontend / Cross-cutting).
2. Group findings by severity. Apply this rubric strictly:
   - **Critical** — blocks merge. Security, data loss, multi-tenant leak, production crash, breaking the response contract.
   - **High** — should fix before merge. Architecture violation, probable bug, missing test that protects a critical path.
   - **Medium** — recommend fixing. Maintainability, performance smell, duplication.
   - **Low / Nitpick** — optional. Style, naming, comment quality.
3. Cite `file:line` for every finding. State the issue, then the fix.
4. Open the report with what is **good** before what's wrong — reviewers are mentors, not gatekeepers.

---

## Backend

### Critical (block merge)

| # | Anti-pattern | Why it's critical |
|---|--------------|-------------------|
| B-C1 | **Missing `account_id` filter** on a request-driven Prisma query (read OR write) | Cross-tenant data leak. (The documented `*Internal` / `listAll` / `updateStatus` system-triggered methods are the only exceptions — see `patterns/backend.md` § Multi-tenancy) |
| B-C2 | **Missing `deleted_at: null` filter** on a read | Returns soft-deleted data |
| B-C3 | **Cross-account access not enforced** — an entity reached without an `accountId`-scoped repository read (or, after an unscoped read, without an explicit same-account policy check) | Data leak |
| B-C4 | **`throw new Error(...)`** in domain or application | Becomes 500 with no code; violates `AppError` contract |
| B-C5 | **Sensitive data in logs** (phone numbers, message text, contact/group names, user email, webhook URLs with secrets, WhatsApp session keys, password, tokens, full prompts) | PII/secret leak — Pino `redact` is not a substitute for not logging |
| B-C6 | **Missing `validateRequest(...)` middleware** on a route accepting input | Untrusted input reaches the use case |
| B-C7 | **Raw SQL with string interpolation** | Injection |
| B-C8 | **Response shape that breaks the envelope** (`res.json(data)` without `{ ok, data }`) | Frontend `httpClient` interceptor will misparse |
| B-C9 | **Use case touches `Request`/`Response`** | Coupling to Express; untestable |
| B-C10 | **Domain or application imports from `infrastructure/`** | Inverted dependency, breaks Clean Architecture |
| B-C11 | **Auth middleware missing** on a route that's not explicitly public | Anyone can call it |
| B-C12 | **CSRF token check skipped** on a state-changing route in cookie-auth flow | CSRF vulnerability |
| B-C13 | **Direct LLM API/SDK call** (fetch/axios to OpenAI/Anthropic, or the vendor SDK imported outside `core/provider/llm/`) instead of an `ILlmProvider` port | No cost tracking, no fallback, no observability (R23) |

### High (should fix)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| B-H1 | Repository returns raw Prisma type (snake_case) instead of domain entity | Map via private `toEntity()`; return `Entity` |
| B-H2 | Use case returns raw entity instead of `entity.toJSON()` | Always `.toJSON()` (controls serialization) |
| B-H3 | Prisma catch block missing `mapPrismaError(error)` | Add `} catch (error) { throw mapPrismaError(error); }` |
| B-H4 | New `ErrorCode` added without translations in all 3 locales | Add to `pt-BR/errors.json`, `en/errors.json`, `es/errors.json` |
| B-H5 | Repository / provider / service not registered in `core/container/index.ts` (via the module's `register<Domain>Module`) | Will fail at runtime via `container.resolve(...)` |
| B-H6 | Use case directly instantiates a dependency (`new RedisCacheProvider()`) instead of `@inject(...)` | Untestable, defeats DI |
| B-H7 | Multi-step write across tables not wrapped in `prisma.$transaction(...)` | Risk of orphan rows on partial failure |
| B-H8 | List endpoint without pagination (`findMany` without `skip`/`take`) | Unbounded query; will timeout at scale |
| B-H9 | N+1 query (loop calling `findById` instead of `findMany({ where: { id: { in: ids } } })`) | Easy to miss; add an `include` or batch query |
| B-H10 | Long-running operation (file cleanup, bulk delete >10, email, webhook fan-out, LLM call) inline instead of queued | Move to BullMQ |
| B-H11 | Inline tenancy check (`if (!entity \|\| entity.accountId !== caller)`) after an unscoped read, instead of a scoped repository read (`findById(accountId, id)`) | Scope the read; if a post-read check is genuinely needed, add a `shared/policy/` helper, never an inline `if` |
| B-H12 | `console.log` instead of `ILoggerProvider` | Replace; never ship `console.*` |
| B-H13 | Missing `@@index([account_id])` on a multi-tenant table | Add in `schema.prisma` and migrate |
| B-H14 | Test mocks the database (Prisma client) instead of mocking the repository | Mock at the repository boundary; integration tests should hit a real DB |
| B-H15 | Job processor missing per-item `try/catch` (one bad item kills the whole batch) | Wrap each iteration; track `succeeded` / `failed` |
| B-H16 | `ForbiddenError` thrown for cross-tenant access (reveals existence) | Use `NotFoundError` instead |

### Medium (recommended)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| B-M1 | DTO not reusing `UuidParamSchema` / `PaginationQuerySchema` / `BulkDeleteDTOSchema` | Compose from `shared/dto/common.dto.ts` |
| B-M2 | Date received as `z.string()` instead of `z.coerce.date()` | Use `z.coerce.date()` so the use case receives a `Date` |
| B-M3 | Bulk-delete route declared **after** `/:id` (route conflict) | Declare `/bulk` BEFORE `/:id` |
| B-M4 | Write on a cached entity (`Cached*Repository`) without the matching eviction, or eviction ordered before the write | Evict after the write; document the sub-TTL stale window (see `knowledge/code-review.md`) |
| B-M5 | `safeS3Delete()` not used for file cleanup (regular delete that can throw) | Use `safeS3Delete` (idempotent, swallows missing-key) |
| B-M6 | Request-driven repository method missing the `accountId` parameter | Add it; every request-driven read/write is tenant-scoped. System-triggered methods must be named `*Internal` and documented |
| B-M7 | Tests assert on entity (`.id`) instead of `expect.objectContaining({ ... })` for partial match | Use `expect.objectContaining` for resilience |
| B-M8 | New entity created without a factory (`makeXxx`) | Add factory in `modules/<domain>/test/`; reuse across tests |
| B-M9 | New repository created without a `mockXxxRepository()` | Add in `src/test/mocks/repositories.mock.ts` |
| B-M10 | `LinkEntityModal` / generic shared utility duplicated for new entity | Reuse the existing one |
| B-M11 | Hard-coded magic string used as queue name / job name | Add to `shared/constant/queue-jobs.ts` |

### Low / Nitpick

| # | Issue |
|---|-------|
| B-L1 | `any` instead of `unknown` |
| B-L2 | Missing JSDoc on a public service method |
| B-L3 | Inconsistent variable naming (mix of `accountId` / `account_id` in TS code — should always be `accountId` outside Prisma) |
| B-L4 | Import ordering not following project convention (interfaces first, then impls) |
| B-L5 | Trailing comments left from scratch work |

---

## Frontend

### Critical (block merge)

| # | Anti-pattern | Why |
|---|--------------|-----|
| F-C1 | **Component calls `httpClient` directly** (bypassing repository + hook) | Breaks DI; untestable |
| F-C2 | **Hardcoded color hex** (`color="#ff0000"`, `bg="#fff"`) instead of semantic token | Breaks dark mode; bypasses theme |
| F-C3 | **Yellow / orange tone used anywhere** (`yellow.*`, `amber.*`, `orange.*`, `#ffd700`, `#ffa500`) | Hard project rule — use `purple` for warnings, `red` for errors |
| F-C4 | **Token / sensitive data put into URL or stored in non-`localStorage` location** | Leaks via referrer, history, or 3rd-party scripts |
| F-C5 | **Mutation without `onError`** | Silent failure — bug |
| F-C6 | **`queryClient.invalidateQueries()` with no key** (or with `queryKeys.X.all`) | Refetches everything; wrecks perf |
| F-C7 | **Hardcoded API path** (`fetch("/api/...")`) instead of repository method | Breaks contract layering |
| F-C8 | **User-visible string not in i18n** | Untranslated; breaks pt-BR/en/es flow |
| F-C9 | **Hardcoded route string** (`navigate("/devices/" + id)`) instead of `ROUTE_PATHS.deviceDetail.replace(":id", id)` | Refactor-hostile |
| F-C20 | **Kitchen-sink hook** — hook em `modules/*/presentation/hooks/` com >2 `useQuery` distintos | Quebra em hooks focados (uma query principal + mutations). Quebra o lazy boundary do tab e força fetch de dados não consumidos. Exceção: hooks compartilhados em `shared/hooks/` que compõem (`useDetailPageController`, etc.) |

### High (should fix)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| F-H1 | New repository not registered in `core/di/repositories.ts` | Add singleton; use the type-cast pattern |
| F-H2 | New query key not added to `core/query/queryKeys.ts` factory | Add hierarchical key (`all`, `list`, `search`, `detail`, ...) |
| F-H3 | List page reimplements `useListPageController` logic inline | Use the shared hook |
| F-H4 | Detail page reimplements auto-save + dirty + validation | Use `useDetailPageController` + `useUnsavedChangesGuard` |
| F-H5 | Validated form built without RHF + Zod (manual `useState` everywhere) | Use RHF + `zodResolver(buildXSchema())` with lazy schema for i18n |
| F-H6 | Form built with raw `<Input>` instead of `FormField` / `SelectField` / `DateField` / etc. | Use the shared form primitive |
| F-H7 | Modal owned by global state / URL instead of `useDisclosure` in parent | Lift to parent; ephemeral state belongs there |
| F-H8 | Loading state shows bare `<Spinner />` instead of skeleton | Use `DetailPageSkeleton` / `ListPageSkeleton` / dedicated skeleton |
| F-H9 | Empty state shows "No data" with no CTA | Use `<EmptyState icon title description actionLabel onAction>` |
| F-H10 | Component rendered inside `.map()` without `memo()` | Wrap with `memo()`; pass stable handlers via `useCallback` |
| F-H11 | Handler defined inline in render and passed to memoized child | Move to `useCallback` |
| F-H12 | Date received from API as string but passed straight to `Date` math without conversion | Convert at the render boundary; entity type stays `string` (ISO) |
| F-H13 | Frontend entity field name diverges from API DTO (e.g., `birth_date` instead of `birthDate`) | Mirror the API DTO 1:1 |
| F-H14 | Repository method missing explicit return type | Add `: Promise<X>` so consumers don't infer wrong types |
| F-H15 | i18n key added to one locale only | Add to all 3 (pt-BR, en, es) |
| F-H16 | Color-mode conditional in component (`useColorMode().colorMode === "dark" ? ... : ...`) | Use semantic token with `_dark` variant |
| F-H17 | Test selectors using CSS classes (`.chakra-button`, `.css-xyz`) | Use `getByRole` / `getByLabel` / `getByText` |
| F-H18 | `<AppTabs>` com `isLazy={false}` sem justificativa documentada | Default global é lazy; opt-out apenas se a aba precisa pré-montar (raro, documentar no código) — ver `patterns/frontend.md` § Data-fetching scope |
| F-H19 | Hook de feature com `useQuery` que não aceita `{ enabled }` opcional | Callers fora de tab boundary (ex: `useDeviceDetail` chamado só pelo nome no breadcrumb) precisam poder suspender — `useDeviceQr(id, enabled)` / `useDeviceGroups(id, enabled)` são o precedente |
| F-H20 | `staleTime` como literal numérico (ex: `5 * 60_000`) em vez de `STALE_TIMES.x` | Importar de `core/query/staleTimes.ts` (`default` / `reference` / `volatile` / `subscription`). Exceção: `staleTime: 0` (refetch sempre, intencional em polling) |
| F-H21 | `queryKey` montado via spread inline (`[...queryKeys.X.Y(), params]`) em vez de chamar `queryKeys.X.Y(params)` | Factory deve aceitar params na assinatura (ver `messaging.messageStatus(id)`, `devices.qr(id)`). Spread inline quebra o contrato e esconde a forma da key de tooling/DevTools |
| F-H22 | `useInfiniteQuery` com filtros/search no queryKey sem `placeholderData: keepPreviousData` | Sem isso, o grid colapsa para skeleton em cada keystroke/troca de filtro. `useInfiniteListPage` já cobre — hooks que constroem `useInfiniteQuery` direto precisam adicionar manualmente |
| F-H23 | `gcTime ≤ staleTime` no `queryClient` (ou em hook que sobrescreva ambos) | Quando bate, cache evictado no instante que vira stale — navegação away-and-back sempre refetch. Regra: `gcTime ≥ 3× staleTime.reference` (ver `GC_TIMES` em `staleTimes.ts`) |
| F-H24 | Módulo em `apps/web/src/modules/<m>` sem barrel `index.ts` (API pública ausente) | Adicionar `index.ts` exportando entity types + hooks públicos — ver `modules/devices/index.ts` como referência |
| F-H25 | Import cross-módulo alcançando internals (`@/modules/<outro>/(domain\|infrastructure\|presentation)/**`) em vez do barrel `@/modules/<outro>` | Importar pelo barrel; um módulo é caixa-preta para os outros (§ regra de fronteira) |
| F-H26 | `presentation` importando `infrastructure` direto (classe/instância de `Http*Repository`) | Resolver o repositório via `core/di` e consumir por um hook — também pego por `no-restricted-imports` no `.eslintrc.cjs` |
| F-H27 | React Context (`createContext`) definido solto na raiz de `presentation/` em vez de `presentation/context/` | Mover a definição + o Provider para `presentation/context/` (§ slots) |
| F-H29 | `useQuery` / `useInfiniteQuery` / `useMutation` definido inline em componente/página/context em vez de um hook de módulo (`presentation/hooks/`) ou `shared/hooks/` | Extrair para o hook dono; coreografia de UI acoplada ao ciclo da mutation (overlay, redirect, polling stop) entra por callbacks/opções do hook (precedente: `useMessageStatus` em `messaging/presentation/hooks/`). (`F-H28` está reservado — código compartilhado com o repo irmão) |
| F-H30 | Mesma resource key com mais de uma definição de query (queryFn/enabled/staleTime duplicados por call site) | Um hook canônico por recurso (`useDevicesList`, `useDeviceDetail(id)`, `useMessageStatus(id)`); consumidores derivam do dono ou passam `{ enabled }`/tier. Segundo observer intencional (polling compartilhado, ex.: o QR poll) exige comentário no hook |

### Medium (recommended)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| F-M1 | Custom card built when `EntityCard` would work | Reuse `EntityCard` |
| F-M2 | Custom modal wrapper built when `AppModal` would work | Reuse `AppModal` |
| F-M3 | Repository missing `bulkDelete` when the list page exposes bulk actions | Add and implement on backend too |
| F-M4 | Page does not call `useUnsavedChangesGuard(isDirty)` when editable | Add to prevent accidental nav |
| F-M5 | Hardcoded animation duration / easing | Use `TRANSITION_DEFAULT` / `EASE_ORGANIC` from `shared/constants/animation.ts` |
| F-M6 | Layout not responsive (no `{ base, md, lg }` syntax) | Add responsive props |
| F-M7 | Icon-only button without `aria-label` | Add `aria-label` |
| F-M8 | Form submit without `isLoading` on the primary button | Bind `isLoading` to mutation pending state |
| F-M9 | Mutation success without `useNotify().showSuccess(...)` | Always confirm user actions |
| F-M10 | Search input not debounced (or debounce > 300ms) | Use `useDebounce(value, 300)` or `useServerListPage` (built-in) |
| F-M11 | Auto-save debounce ≠ 1500ms | Match the project default (`useDetailPageController`) |
| F-M12 | Heavy component imported eagerly (rich text editor, chart lib) | `React.lazy()` |
| F-M13 | Section consome um hook de relação eager (ex.: `useDeviceGroups(id)`) quando o dado só é usado condicionalmente (modal fechado, lista vazia) | Adicionar `enabled` derivado da condição (`enabled: items.length > 0 \|\| modal.isOpen`). Variante section-scoped do F-C20 |
| F-M14 | `usePrefetchEntity` / `prefetchQuery` chamado com `staleTime` diferente do consumidor que vai ler o cache | Quebra deduplicação — prefetch dispara fetch duplo. Mesmo `STALE_TIMES.x` em ambos |
| F-M15 | ListPage / modal de create chama `useEntity()` (entity hook completo) só para consumir mutations | Padrão definitivo: hook focado em ações (`useXActions()` / `useCreateX()`) construído com `useEntityActions` / `useEntityCreate` de `shared/hooks/`. Pattern transicional `useEntity({ enabled: false })` registra observer fantasma — não usar em código novo |
| F-M16 | `useDeviceDetail(undefined)` etc — chamar entity-hook sem id para pegar só `createX` | Usar `useCreateX()` focado (`useCreateDevice` é o precedente). O entity-hook deveria exigir id (callers de create-only não precisam do detail useQuery) |

### Low / Nitpick

| # | Issue |
|---|-------|
| F-L1 | `any` instead of `unknown` |
| F-L2 | Inline type instead of named `Props` interface for a reusable component |
| F-L3 | Unused imports |
| F-L4 | Inline arrow functions in JSX where a `useCallback` would help (only flag if memoized child) |
| F-L5 | Inconsistent prefix (`onSubmit` vs `handleSubmit` for the same purpose) — `on*` for props, `handle*` for internal |

---

## E2E Tests (`apps/web/e2e/`)

Canonical doc: `patterns/e2e.md`. Same rubric as the **F-** family — Critical blocks merge, High should fix, Medium is normalization, Low is nitpick. The `code-auditor` agent and `post-edit-e2e.sh` hook surface these codes mechanically; the `e2e-test-writer` agent self-audits against them at the end of every run.

### Critical (blocks merge)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| E-C1 | CSS class / XPath / `[class*=...]` / auto-generated id selector in a spec or POM (broadens `F-H17` — `F-H17` covers CSS classes only; E-C1 also covers XPath, generated ids, and `[class*=...]`) | `getByRole` → `getByLabel` → `getByText` → `getByPlaceholder` → `getByTestId`. See `patterns/e2e.md` § "The 5 selector rules" |
| E-C2 | Spec performs a manual login (`page.goto("/sign-in")` + fill + click) instead of relying on `global.setup.ts` storage state | Remove the login; the `chromium`/`docs` projects already inject auth. For anon flows, build a fresh `browser.newContext({ storageState: { cookies: [], origins: [] } })` |
| E-C3 | `page.waitForTimeout(...)` used outside the documented 500ms search-debounce convention | Replace with `expect(locator).toBeVisible({ timeout })` or `page.waitForURL(...)`. The only allowed hard wait is debounce/throttle — comment why |
| E-C4 | Hardcoded production credentials, real PII, real API keys, or real customer data in a spec or fixture | Use `createUnique<Entity>()` factories or seeded test accounts. Never commit real secrets — see `X-C4` |

### High (should fix)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| E-H1 | Text assertion in a single language (e.g. `getByText("Salvar")` or `getByText("Save")` only) | Bilingual regex: `getByText(/salvar|save/i)`. The project ships in pt-BR/en/es; CI's storage state pins pt-BR but locale can flip |
| E-H2 | `.nth(...)`, `.first()`, or `.last()` used to disambiguate a fragile locator instead of refining it | `.filter({ has: ... })` / `.filter({ hasText: ... })` or scope to a `getByRole("dialog")` parent |
| E-H3 | Page Object god-method (`createAndEditAndDelete(...)`) | Split into atomic methods; the spec composes them |
| E-H4 | One spec file bundles unrelated flows (`describe("Full CRUD") { it("create"); it("edit"); it("delete") }`) | One flow per file: `<entity>-create.spec.ts`, `<entity>-edit.spec.ts`, `<entity>-delete.spec.ts`. See `patterns/e2e.md` § "Naming" |
| E-H5 | `afterEach` cleanup not wrapped in `try/catch` — cleanup failure marks the test red | Wrap cleanup in `try { ... } catch { /* best-effort */ }`. The test asserts on the act, not on the cleanup |
| E-H6 | POM or spec imports concrete code from `apps/web/src/**` (only type-only imports allowed, and only in `fixtures/*.mocks.ts`) | Re-declare what you need in the POM. Pulling repositories / hooks into e2e creates a bidirectional coupling and breaks isolation |
| E-H7 | Spec reaches for a locator that is already exposed by the POM | Move the locator to the POM as a `readonly` field; reference it from the spec |

### Medium (recommended)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| E-M1 | Inline test data when ≥2 tests need it | Promote to `fixtures/test-data.ts` (`TEST_<ENTITY>` for fixed, `createUnique<Entity>()` for dynamic) |
| E-M2 | Flow spec without a single negative-path test | Add at least one validation / rejection / error-toast assertion. Pure happy-path specs hide regressions |
| E-M3 | New `page.waitForLoadState("networkidle")` introduced without a comment explaining the specific race | Prefer `expect(locator).toBeVisible({ timeout })`. `networkidle` is tolerated as legacy in lists with infinite scroll — comment the reason |
| E-M4 | `getByTestId("...")` reached for before trying role / label / text | Try the four semantic locators first. If a testid is necessary, add it to the source component and note the reason in the POM |
| E-M5 | New e2e selector pattern that the auditor's grep doesn't know about (proposed) | Promote the pattern to `code-auditor.md` / `post-edit-e2e.sh` |

### Low / Nitpick

| # | Issue |
|---|-------|
| E-L1 | `describe("...")` title doesn't mirror the spec filename (`device-create.spec.ts` → `describe("Device Creation")`) |
| E-L2 | Bilingual regex missing case-insensitive `i` flag |
| E-L3 | Unused imports from `@playwright/test` (`expect` re-imported from the fixture barrel) |
| E-L4 | POM method named `clickXButton` when `clickX` reads cleaner — follow the project POM style (`clickAdd`, `submit<Form>`, `delete<Entity>FromList`) |

---

## Cross-Cutting

### Critical

| # | Anti-pattern | Why |
|---|--------------|-----|
| X-C1 | **Backend response field renamed without updating frontend entity** | Runtime breakage |
| X-C2 | **New backend `ErrorCode` not handled by frontend** (no toast on that path) | Silent failure |
| X-C3 | **Migration without rollback consideration** (irreversible drop column) on a non-empty production table | Data loss |
| X-C4 | **Secret committed** (API key, JWT secret, DB URL with creds) | Immediate revocation needed |

### High

| # | Anti-pattern | Fix |
|---|--------------|-----|
| X-H1 | New backend endpoint without updating the frontend repository / hook | Add the method; otherwise the endpoint is dead code |
| X-H2 | Backend pagination shape changed but frontend still expects old `meta` keys | Realign |
| X-H3 | Test suites broken (`yarn test` red) | Don't merge red |
| X-H4 | New env var added but `apps/api/src/core/config/env.ts` (Zod schema) not updated | App won't boot |
| X-H5 | New `ErrorCode` exists in pt-BR locale only | Add en + es |

### Medium

| # | Anti-pattern | Fix |
|---|--------------|-----|
| X-M1 | New shared backend utility added under generic `util/` filename | Name by purpose (`pagination.ts`, not `helpers.ts`) |
| X-M2 | New shared frontend hook duplicates an existing one | Check `shared/hooks/` catalog before creating |
| X-M3 | Commit message doesn't follow conventional commits | Use `feat:` / `fix:` / `refactor:` / `chore:` |

---

## Spec Compliance & Scope (`SC-*`)

This project follows Spec-Driven Development (`patterns/spec.md`): every non-trivial task has a Task Spec in `.claude/specs/<slug>.md`. The reviewer receives the spec path and judges the diff **against the contract**. When no spec file exists (trivial task), evaluate these codes against the user's request as stated in the conversation. (Prefix is `SC-*`, not `S-*` — the bare `S-*` namespace is reserved and must not be minted here.)

### Critical

| # | Anti-pattern | Why |
|---|--------------|-----|
| SC-C1 | **Implemented behavior contradicts an explicit acceptance criterion** of the task spec | The contract is the agreement with the user; contradicting it ships the wrong product |

### High

| # | Anti-pattern | Fix |
|---|--------------|-----|
| SC-H1 | **AC silently dropped** — an acceptance criterion with no implementing code/test and no entry in the spec's Decisions log / "Out (deferred)" | Either implement it or move it to Out explicitly with the user's awareness |
| SC-H2 | **Scope creep** — behavior/feature/surface in the diff that no AC (and no Decisions-log entry) covers | Remove it, or take it to the spec first. "While we're at it" is a defect |
| SC-H3 | **Speculative abstraction (inflated code)** — interface with a single implementation, options nobody passes, config nobody reads, generic helper with one caller, "for future use" parameters | Inline it. Abstractions earn their existence at the second real consumer |
| SC-H4 | **No spec for a non-trivial task** — diff touches ≥3 files / changes behavior but `.claude/specs/<slug>.md` doesn't exist | Write the micro-spec retroactively before merge (R26); the gate exists to prevent the next occurrence |

### Medium

| # | Anti-pattern | Fix |
|---|--------------|-----|
| SC-M1 | Drive-by refactor outside the spec's files plan mixed into the diff | Split into a follow-up; the PR diff stays scoped to the contract |
| SC-M2 | Dead code in the diff: unused exports, commented-out blocks, leftover scaffolding | Delete before handoff |
| SC-M3 | New dependency not justified in the spec | Justify in the spec's Decisions log or remove |

---

## Output Format (for the `/code-review` skill)

```markdown
## Code Review: [scope]

### What's Good
- [Reinforce 2–4 positive patterns observed]

### Critical (blocks merge)
| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|

### High (should fix)
| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|

### Medium (recommended)
| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|

### Low / Nitpick
| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|

### Summary
- **Critical:** N | **High:** N | **Medium:** N | **Low:** N
- **Approved for merge?** Yes / Yes with caveats / No (fix critical first)
- **Quality:** [1-2 sentences]
```

**Rules for the reviewer:**
- Cite the anti-pattern code (B-C1, F-H3, etc.) when you reference one — makes feedback portable.
- Max 3 actionable items per file in the report (avoid noise; prioritize impact).
- If you flag something **not** in this checklist, it's still valid — but consider proposing it as a new entry in a follow-up.
- Severity is real: a typo is not Critical. Be proportional.
