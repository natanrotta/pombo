# Frontend Architecture — Canonical Lifecycle (Authority)

**This document is the single source of truth for how data flows from a user action → API → render in the frontend.**

Every frontend skill (`/frontend`, `/fullstack`, `/ui-design`, `/code-review`, `/test-e2e`) MUST defer to this document. If a skill contradicts this file, this file wins. If you discover a divergence between this file and the actual code, update this file.

---

## Stack

- **Bundler:** Vite
- **Framework:** React 19 (functional + hooks, no class components)
- **Router:** React Router v6 (config-based, lazy + Suspense)
- **UI:** Chakra UI **v3** with a custom system + semantic tokens. The design system (palettes, semantic tokens, text styles, recipes, `fieldBase`) lives in the source-only package `packages/theme` (`@pombo/theme`); `app/theme/index.ts` only composes it — `createSystem(defaultConfig, pomboThemeConfig, config)`, where `config` holds the app's `globalCss`; the **snippets** in `src/components/ui/*` (the upstream `chakra snippet` shape) are the ONLY place a v3 compound component (Dialog, Menu, Popover, Field, Drawer, NativeSelect, NumberInput, PinInput, Tooltip, Avatar, Toaster) is assembled — product components consume the snippet, never `Dialog.Root` directly.
- **Color mode:** `next-themes` (class strategy) behind `components/ui/color-mode`. `useColorMode()` / `useColorModeValue()` come from there, never from `@chakra-ui/react`. Storage key: `pombo-color-mode`; `defaultTheme="system"`.
- **State (server):** TanStack Query v5
- **State (global UI):** React Context only (Auth, Sidebar) — **no Redux, no Zustand**. If a feature needs its own navigation/UI state (never server data — that lives in TanStack Query), use a small feature-scoped Context under `presentation/context/` and document why.
- **Forms (validated):** react-hook-form + Zod (lazy schema builders for i18n)
- **Forms (simple modals):** `useFormState` hook
- **HTTP:** Axios with interceptors (session cookie ride-along, refresh, CSRF, language, envelope unwrap). If you ever need a streaming transport (SSE — e.g. live device/message events), Axios can't stream in the browser — use native `fetch` and re-attach `credentials: "include"` + the CSRF header (`getCsrfToken`) manually.
- **Animations:** Framer Motion 12 (`motion.create(Box)` — `motion(Component)` is deprecated; organic easing)
- **i18n:** react-i18next (3 locales: pt-BR default, en, es). Only **pt-BR** (the fallback) is bundled in the entry chunk; en/es load on demand as one lazy chunk each (see `shared/i18n/index.ts` + `locales/{en,es}/index.ts`).
- **Tests:** Vitest (co-located `*.spec.ts(x)` unit/component tests, `jsdom`) + Playwright (e2e in `apps/web/e2e/`)
- **TypeScript:** strict, no `any` (use `unknown` and narrow)

---

## Layer Structure (`apps/web/src/`)

```
app/                              # App-level setup (one-time)
  router/AppRouter.tsx            # Lazy + Suspense + guards
  router/RoutePaths.ts            # All paths centralized — no string literals in components
  theme/index.ts                  # createSystem(defaultConfig, pomboThemeConfig, globalCss) -> `system` + COLOR_MODE_STORAGE_KEY
  theme/tokenContract.spec.ts     # every semantic token has _dark · no warm hues · no unknown token in src
                                  # (foundations live in packages/theme/src/foundations: colors, typography,
                                  #  radii, shadows, semantic-tokens, text-styles, recipes + `fieldBase`)
  providers/                      # AppProviders (Chakra v3 Provider + Toaster, QueryClient, Auth)

components/ui/                    # Chakra v3 snippets — vendored primitives, not product code
                                  #   provider · color-mode · toaster · dialog · drawer · menu
                                  #   popover · field · native-select · number-input · pin-input
                                  #   tooltip · avatar · close-button

core/                             # Cross-cutting infrastructure
  di/repositories.ts              # Singleton repository registry
  http/httpClient.ts              # Axios + interceptors (refresh, envelope unwrap, CSRF, language)
  errors/AppError.ts              # message, code, statusCode, details
  query/queryClient.ts            # TanStack QueryClient config
  query/queryKeys.ts              # ALL query keys (factory pattern, hierarchical)
  query/staleTimes.ts             # STALE_TIMES / GC_TIMES tiers
  query/useErrorHandler.ts        # handleError(error, fallback)

modules/{feature}/                # Feature modules (one per domain — account, auth, devices, messaging, settings)
  domain/
    entities/{Entity}.ts          # Plain TS interface + Create/Update input types
    repositories/{Entity}Repository.ts  # purpose-built contract for the domain
    services/                     # (optional) pure, reusable domain logic
  application/                    # (OPTIONAL, on demand) framework-agnostic orchestration
    use-case/                     #   headless use-cases when a hook outgrows itself
    dto/                          #   Zod form schemas + inferred types
  infrastructure/
    repositories/Http{Entity}Repository.ts  # implements the interface
  presentation/                   # every React surface of the module
    pages/                        # Route-level components (own all queries)
    components/                   # Module-specific components (group by feature when large)
    hooks/                        # use{Entity} (detail), use{Entities} (list), use{Entity}Schemas — the FE "use case"
    context/                      # Context providers scoped to the module (definition + provider)
    constants/                    # Module-specific constants
    styles/                       # (optional) local recipes/sx, if any
    utils/                        # presentation helpers
    types/                        # (optional) local view-models
  routes.tsx                      # (optional) module-owned <Route> tree, aggregated by app/router
  index.ts                        # BARREL — public API (MANDATORY): entity types + public hooks

shared/                           # Cross-module reuse
  components/
    ui/                           # AppModal, EntityCard, EmptyState, PageHeader, SectionCard, ...
    forms/                        # FormField, SelectField, TextAreaField, NumberField, PasswordField
    layout/                       # AppShell, SidebarNav (+ SidebarNavItems, SidebarUserMenu), BrandMark, MobileHeader, MobileBottomNav, AppVersion
    skeletons/                    # ListPageSkeleton, DetailPageSkeleton, ...
    animations/                   # PageTransition
  hooks/                          # useDetailPageController, useFormState, useAutoSave, useNotify,
                                  #   useConfirm, useDebounce, useUnsavedChangesGuard
  contexts/                       # SidebarContext (global UI state)
  i18n/locales/{pt-BR,en,es}/     # One JSON per namespace
  utils/                          # date, phone, passwordValidation, download, chunk reload, storage cleanup
  constants/                      # Animation constants (EASE_ORGANIC, TRANSITION_*), enums
  types/                          # phone
```

**Dependency rule:** `domain` ← `infrastructure` ← `presentation`. Components never import from `infrastructure` directly — always go through `core/di/repositories.ts` and a hook.

---

## Canonical Data-Fetching → Render Lifecycle

For "user opens device detail" (illustrative — mirrors `modules/devices`):

1. `<Route path="/devices/:id" element={<DeviceDetailPage />} />` matches
2. `<DeviceDetailPage />` mounts; `useParams()` reads `id`
3. `useDeviceDetail(id)` is called — the module's canonical detail hook (`modules/devices/presentation/hooks/useDevices.ts`); it owns the `useQuery` for `queryKeys.devices.detail(id)` and the mutations that write it
4. TanStack Query checks cache for `queryKeys.devices.detail(id)`; if stale or missing → `queryFn` runs
5. `queryFn` → `repositories.device.getById(id)` → `HttpDeviceRepository.getById(id)` → `httpClient.get("/devices/" + id)`
6. Axios request interceptor: the session rides the httpOnly `pombo_at` cookie automatically (`withCredentials: true`) — JS never holds the JWT; the interceptor attaches `X-CSRF-Token` (from cookie) and `Accept-Language` (from localStorage). The only Bearer header still built by hand is the short-lived scoped `email:verify` token on the e-mail verification routes.
7. API responds `{ ok: true, data: { id, name, ... } }`
8. Axios response interceptor unwraps: returns `data` directly (or throws `AppError` on `{ ok: false }` / network error)
9. TanStack Query caches under `queryKeys.devices.detail(id)`; component re-renders with `entity` populated
10. `<DetailPageGuard isLoading={isLoading} error={error} entity={entity}>` decides: skeleton / error / not-found / children
11. On success → `PageHeader`, `SectionCard` and `InfoRow` render the content
12. On user edit → `useDetailPageController` updates local state, marks `isDirty=true`, debounces 1500ms → `useAutoSave` triggers `onSave(localData)` → `update.mutateAsync()` → repository PUT → on success: `setQueryData(detail(id), updated)` + `invalidateQueries(search())` + `showAutoSaved()`

---

## Patterns by Layer

### Entity (Domain)

```typescript
// modules/devices/domain/entities/Device.ts
import type {
  DeviceResponseDTO,
  RegisterDeviceRequestDTO,
  UpdateDeviceWebhooksRequestDTO,
} from "@pombo/shared-types";

export type { DeviceStatus, DeviceWebhooks } from "@pombo/shared-types";

export type Device = DeviceResponseDTO;               // dates are ISO strings; convert only at render
export type CreateDeviceInput = RegisterDeviceRequestDTO;
export type UpdateDeviceWebhooksInput = UpdateDeviceWebhooksRequestDTO;
```

**Rules:** the wire contract (request/response DTOs, status/type unions, the `ErrorCodes` catalog, the `{ ok, data }` / `{ ok: false, error }` envelope) is declared **once** in `packages/shared-types` and the API types its projections with it. A module entity file only **aliases** those DTOs into the module's vocabulary — never redeclare a wire field. Types that exist only in the UI (`SandboxMessageType`, `AuthUser`) are declared in the entity file. A new endpoint adds its DTOs to the package first. The web reads the package from its TypeScript source (alias in `apps/web/aliases.ts` + `tsconfig` paths) — never add it back to `optimizeDeps`.

### Repository Interface (Domain)

```typescript
// modules/devices/domain/repositories/DeviceRepository.ts
export interface DeviceRepository {
  list(): Promise<Device[]>;
  getById(id: string): Promise<Device | null>;
  create(input: CreateDeviceInput): Promise<CreatedDevice>;
  updateWebhooks(id: string, input: UpdateDeviceWebhooksInput): Promise<Device>;
  delete(id: string): Promise<void>;
  getQr(id: string): Promise<DeviceQr>;
  connect(id: string): Promise<void>;
  disconnect(id: string): Promise<void>;
}
```

**Rules:** the interface states exactly what the domain needs — no generic CRUD base class. Pombo's domains are not uniform CRUD (`create` returns a one-time secret, `update` is webhook-only, pairing has `connect`/`getQr`), and a shared base would have to be widened until it said nothing. Name the methods after the domain action, not after the HTTP verb.

### HTTP Repository (Infrastructure)

```typescript
// modules/devices/infrastructure/repositories/HttpDeviceRepository.ts
export class HttpDeviceRepository implements DeviceRepository {
  async list(): Promise<Device[]> {
    return httpClient.get<never, Device[]>("/devices");
  }
  async getById(id: string): Promise<Device> {
    return httpClient.get<never, Device>(`/devices/${id}`);
  }
  async create(data: CreateDeviceInput): Promise<Device> {
    return httpClient.post<never, Device>("/devices", data);
  }
  async update(id: string, data: UpdateDeviceWebhooksInput): Promise<Device> {
    return httpClient.patch<never, Device>(`/devices/${id}/webhooks`, data);
  }
  async delete(id: string): Promise<void> { await httpClient.delete(`/devices/${id}`); }
  async connect(id: string): Promise<void> { await httpClient.post(`/devices/${id}/connect`); }
}
```

**Rules:** every method has explicit return type; use `httpClient.<verb><never, ResponseType>(...)` (the `never` is request-body slot — Axios convention here); use `buildPaginationQuery(params)` to serialize search params.

### DI Registration (`core/di/repositories.ts`)

```typescript
import { HttpDeviceRepository } from "@/modules/devices/infrastructure/repositories/HttpDeviceRepository";
import type { DeviceRepository } from "@/modules/devices/domain/repositories/DeviceRepository";

export const repositories = {
  device: new HttpDeviceRepository() as DeviceRepository,
  // ... other singletons
} as const;
```

**Rules:** singletons via the const object; type-cast to interface so consumers depend on the contract, not the impl; never `new HttpXxxRepository()` inside a hook or component — always go through `repositories`.

### Query Keys (`core/query/queryKeys.ts`)

```typescript
devices: {
  all: ["devices"] as const,
  list: () => [...queryKeys.devices.all, "list"] as const,
  detail: (id: string) => [...queryKeys.devices.all, "detail", id] as const,
  qr: (id: string) => [...queryKeys.devices.all, "qr", id] as const,
  groups: (id: string) => [...queryKeys.devices.all, "groups", id] as const,
},
// existing namespaces: settings · auth · devices · account · messaging (messageStatus(id)) · health
```

**Rules:** factory pattern (functions for parameterized keys); hierarchical (`all` is the root, narrow keys nest under it); **never** invalidate a broader key than necessary; **never** `queryClient.invalidateQueries()` without a `queryKey`.

### Hooks — Decision Tree (Reuse First)

| Need | Hook | Source |
|------|------|--------|
| List / detail / mutations for a domain | the module's own hook (`modules/<m>/presentation/hooks/use<X>.ts`) | e.g. `useDevicesList`, `useDeviceDetail` |
| Detail page with auto-save (1500ms) + dirty + validation | `useDetailPageController` | `shared/hooks/useDetailPageController.ts` |
| Debounced auto-save on a value | `useAutoSave` | `shared/hooks/useAutoSave.ts` |
| Modal/standalone form (simple) | `useFormState` | `shared/hooks/useFormState.ts` |
| Validated form (login, register, complex) | `useForm` (RHF) + `zodResolver(buildXSchema())` | direct |
| Toast | `useNotify` (`showSuccess`, `showError`, `showInfo`, `showWarning`, `showAutoSaved`) | `shared/hooks/useNotify.ts` |
| Confirm dialog state | `useConfirm` | `shared/hooks/useConfirm.ts` |
| Unsaved-changes nav guard | `useUnsavedChangesGuard(isDirty)` | `shared/hooks/useUnsavedChangesGuard.ts` |
| Debounce a value | `useDebounce(value, 300)` | `shared/hooks/useDebounce.ts` |
| Open/close state for a modal or drawer | `useDisclosure()` from `@chakra-ui/react` — **v3 returns `open`, not `isOpen`** | direct |
| Centralized error handling | `useErrorHandler()` → `handleError(error, fallback)` | `core/query/useErrorHandler.ts` |

There is deliberately **no** generic `useEntityList` / `useEntityDetail` / `useListPageController` layer: no Pombo module was using it, and a shared CRUD controller only pays for itself once several modules genuinely share the same shape. Build the module hook directly on TanStack Query (see `useDevices.ts`); extract a shared hook the day a second module needs the same one.

```typescript
// modules/devices/presentation/hooks/useDevices.ts (canonical — real exports: useDevicesList, useDeviceDetail,
// useCreateDevice, useDeleteDevice, useConnectDevice, useDisconnectDevice, useDeviceQr, useDeviceGroups, useUpdateDeviceWebhooks)
export function useDeviceDetail(id?: string) {
  return useQuery({
    queryKey: queryKeys.devices.detail(id!),
    // Forward the query's `signal` whenever the repository method takes one:
    // cancelling the query (unmount, key change) then aborts the request
    // instead of leaving it running.
    queryFn: ({ signal }) => repositories.devices.getById(id!, signal),
    enabled: Boolean(id),
  });
}
```

### Page Component (Composition)

Pages own queries, controllers, modal state, and orchestration. Sub-components are dumb and receive `value`, `onChange`, `onClick`.

```typescript
export default function DevicesListPage() {
  const { t } = useTranslation("devices");
  const { data: devices = [], isLoading } = useDevicesList();
  const deleteConfirm = useConfirm();

  if (isLoading) return <ListPageSkeleton />;
  if (devices.length === 0) return <EmptyState ... />;

  return (
    <>
      <PageHeader title={t("list.title")} count={devices.length} primaryAction={...} />
      <FilterBar searchValue={search} onSearchChange={setSearch} />
      {devices.map((device) => <DeviceCard key={device.id} device={device} ... />)}
      <ConfirmDialog isOpen={deleteConfirm.isOpen} ... />
    </>
  );
}
```

### UI Component (Dumb)

```typescript
interface EntityRowProps { title: string; onAction?: () => void; }

export const EntityRow = memo(function EntityRow({ title, onAction }: EntityRowProps) {
  return (
    <Box bg="bg.surface" p={4} borderWidth="1px" borderColor="border.subtle" borderRadius="lg">
      <Text color="text.primary">{title}</Text>
    </Box>
  );
});
```

**Rules:** `memo()` on anything rendered inside `.map()`; explicit Props interface (no inline types for repeated components); no queries here — receive data via props.

---

## Cross-Cutting Concerns

### Routing (`app/router/AppRouter.tsx`, `RoutePaths.ts`)

- Every page is a `lazyWithRetry()` chunk (a stale chunk after a deploy reloads once instead of crashing)
- Guards: `ProtectedRoute` (requires auth), `PublicOnlyRoute` (redirects authenticated)
- All paths in `RoutePaths.ts` — never hardcode `"/devices/:id"` in a component; use `ROUTE_PATHS.deviceDetail.replace(":id", id)`
- Two layout routes in `AppRouter.tsx`: `ProtectedLayout` (`ProtectedRoute` → `AppShell` → `RouteErrorBoundary` → `Suspense`) holds every authenticated page, so the shell stays mounted across navigation; `PublicLayout` (`RouteErrorBoundary`) holds the auth pages. A new page is a `<Route>` under the right layout

### HTTP Client (`core/http/httpClient.ts`)

- baseURL: `import.meta.env.VITE_API_URL || "/api"`, timeout 30s, `withCredentials: true` (httpOnly `pombo_at` session + refresh cookies)
- Request interceptor: the session cookie is sent automatically — no `Authorization` header for normal calls. Attaches CSRF header + `Accept-Language`; deletes `Content-Type` for `FormData` (browser sets boundary). The scoped `email:verify` Bearer is the sole exception (email-verification routes only). `getCsrfToken` is exported for any non-Axios transport you might add (e.g. an SSE `fetch`).
- Response interceptor:
  - Success: unwraps `{ ok: true, data }` → returns `data`
  - 401: queues request, calls `/auth/refresh`, retries on success; on refresh failure clears auth + redirects to sign-in
  - Other failures: throws `AppError(message, code, statusCode, details)`
- All consumers (repositories) get the inner data already typed — never deal with `{ ok, data }` directly

### Forms

**Validated forms (auth, complex):** RHF + Zod with **lazy schema builders**:

```typescript
// modules/auth/domain/schemas.ts
export function buildRegisterSchema() {
  return z.object({
    name: z.string().trim().min(1, tAuth("register.nameRequired")),
    email: z.string().trim().email(tAuth("register.emailRequired")),
    password: z.string().refine(isPasswordStrong, { message: tAuth("register.passwordWeak") }),
  });
}
export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>;

// In the page
const { register, handleSubmit, control, formState: { errors } } = useForm<RegisterFormValues>({
  resolver: zodResolver(buildRegisterSchema()),
  defaultValues: { name: "", email: "", password: "" },
  mode: "onSubmit",
});
```

**Why lazy builders:** `t()` is called when the form mounts, so error messages reflect the current language (i18n changes don't require remounting).

**Simple modals:** `useFormState` with manual validation:

```typescript
const { formData, setField, errors, validate, reset } = useFormState(
  { name: "", status: "ACTIVE" as const },
  { name: (v) => (!v ? tc("forms.required") : null) }
);
```

**Form primitives (`shared/components/forms/`):** Always reuse `FormField`, `SelectField`, `TextAreaField`, `NumberField`, `PasswordField` — **do not** wrap raw Chakra `<Input>` in feature code. Each one composes the `Field` snippet (`components/ui/field`), so label/error/invalid wiring is identical everywhere. The one sanctioned exception is an RHF `register()` input, which needs a ref-spread and therefore uses `<Field>` + `<Input>` directly (see `SignInPage`).

### Modals

- Controlled by parent state via `useDisclosure()` from Chakra — **v3 returns `open`**, so destructure `{ open: isOpen, onOpen, onClose }` to keep call sites reading `isOpen`
- Wrap in `<AppModal isOpen onClose title primaryActionLabel onPrimaryAction isPrimaryLoading>` — gives standard footer (cancel + primary)
- **No** global modal store; **no** URL sync for modals (modals are ephemeral, not bookmarkable)
- Sticky headers on long modals; `size="md"` default, `"lg"` for forms with many fields

### Loading / Error / Empty States

| Surface | Use |
|---------|-----|
| Detail page | `<DetailPageGuard isLoading error entity skeletonVariant="profile" notFoundMessage>{children}</DetailPageGuard>` |
| List page | `<ListPageSkeleton />` while loading, then the cards; `<EmptyState>` when the list is empty |
| Section / card | `<SectionCardSkeleton />`, `<EntityCardSkeleton />` |
| Session check / route chunk | handled by the shell: `ProtectedRoute` renders `<AppShellSkeleton />`, the route `Suspense` renders `<RouteContentSkeleton />` — pages never add their own |
| Manual empty | `<EmptyState icon title description actionLabel onAction />` |
| Manual error | `useNotify().showError(error, fallback)` toast |
| Render error | `<RouteErrorBoundary>` (in both layout routes of `AppRouter.tsx`); `<GlobalErrorBoundary>` (root) |

**Never** use a bare `<Spinner />` for primary content — always a skeleton matching the target layout. **Never** show a blank area when there's no data — always `<EmptyState>` with helpful CTA.

### Mutations + Cache Invalidation

| Mutation | Cache Update | Invalidate |
|----------|--------------|-----------|
| **create** | `setQueryData(detail(newId), newEntity)` | `search()` |
| **update** | `setQueryData(detail(id), updated)` | `search()` |
| **delete (single)** | optimistic remove from `search()` (rollback on error) | `search()` on settled |
| **bulkDelete** | optimistic remove ids from `search()` | `search()` on settled |
| **linkRelation** | — | `linked{Related}(parentId)` |
| **unlinkRelation** | — | `linked{Related}(parentId)` |
| **saveFieldValues** | `setQueryData(fieldValues(entityId), values)` | — |

**Rules:**
- **Never** invalidate `all` — clears the whole entity tree, refetches everything, kills perf
- Use `setQueryData` for the entity you just mutated (instant UI)
- Use `invalidateQueries` for list/search keys (background refetch)
- On create → navigate to detail; the detail will already be in cache so no flash
- On delete from detail → navigate back to list

### Error Handling

- API errors arrive as `AppError(message, code, statusCode, details)` (interceptor wraps everything)
- In a mutation: `onError: (error) => handleError(error, fallback)` from `useErrorHandler()`
- `useNotify().showError(error)` extracts the message; for `code === "VALIDATION_ERROR"` flattens `details` into a readable string
- **Every mutation has an `onError`** — silent failures are bugs

### Optimistic Updates

The module hook owns the optimistic path; the canonical shape is:

```typescript
onMutate: async (deletedId) => {
  await queryClient.cancelQueries({ queryKey: keys.list() });
  const previous = queryClient.getQueryData<T[]>(keys.list());
  queryClient.setQueryData<T[]>(keys.list(), (prev) => prev?.filter((x) => x.id !== deletedId) ?? []);
  return { previous };
},
onError: (_err, deletedId, ctx) => {
  // Restore ONLY the failed item into the current cache — resetting the whole
  // snapshot resurrects items a concurrent optimistic delete already removed.
  if (ctx?.previous) queryClient.setQueryData<T[]>(keys.list(), (current) => restoreItem(current, ctx.previous, deletedId));
},
onSettled: () => queryClient.invalidateQueries({ queryKey: keys.list() }),
```

`restoreItem` re-inserts the item at its old position relative to the items still listed (see `restoreDevice` in `modules/devices/presentation/hooks/useDevices.ts`). A `useConfirm` dialog closes before its mutation resolves, so two deletes can overlap.

Use this pattern only when the operation is fast and rollback is cheap; otherwise prefer `invalidate-then-refetch` for correctness.

### Data-fetching scope, lazy mount, and prefetch

**Princípio:** o usuário só paga por dados que está prestes a ver.

1. **Lazy mount por boundary.** Um painel/seção que só aparece depois de uma interação (aba, accordion, drawer) deve montar de forma preguiçosa — na v3 isso é `lazyMount` (+ `unmountOnExit` quando o estado não deve sobreviver ao fechamento). Componentes dentro desse boundary SÓ disparam queries quando o usuário chega lá. Opt-out só com motivo documentado. **Hoje o app não tem nenhuma `Tabs`** — quando a primeira voltar, ela nasce com `lazyMount`.

2. **Section-scoped fetch (não kitchen-sink).** Cada section/aba é responsável pelo próprio fetch. NÃO chamar hooks de relação no parent e passar dados por prop — quebra o lazy boundary. Padrão correto: `<DeviceWebhooksSection deviceId={id} />` chama o hook que precisa internamente. Modais auxiliares também devem viver dentro da section que os usa.

3. **Hooks focados (não kitchen-sink).** Hook de feature deve encapsular UMA query principal + suas mutations relacionadas. Se um hook tem >2 `useQuery` distintos, está virando kitchen-sink — quebrar em hooks menores. Aceitar `{ enabled }` opcional para callers fora de tab que precisam suspender manualmente (ex: uma página chama `useDeviceDetail(id)` só pelo breadcrumb name).

4. **Prefetch on hover.** `<EntityCard>` expõe `onHover` para isso: ligue um `queryClient.prefetchQuery` do hook do módulo e passe `onHover={() => prefetch(item.id)}`. Pre-aquece o cache no hover/focus — sem custo se o user não clicar (TanStack Query gerencia gc/stale, segundo prefetch dentro do staleTime é no-op).

5. **Stale tiers (`STALE_TIMES` em `core/query/staleTimes.ts`):**
   - `default: 60_000` — entidades transacionais (device, api token, perfil). Match com o `queryClient` default; passar é opcional.
   - `reference: 5*60_000` — reference data (lookups, enums, settings). Mudam raramente, evita refetch agressivo.
   - `volatile: 15_000` — dados muito dinâmicos (status de conexão, listas que dependem do socket ao vivo — ex.: grupos do device, `retry: false` + estado de erro próprio).
   - `subscription: 30_000` — polling de status (entre default e volatile). O poll de status de mensagem e o poll do QR usam `refetchInterval` próprio — e param (`return false`) em erro terminal.
   O hook do módulo escolhe o tier explicitamente via `staleTime`.

6. **`gcTime` ≥ 3× `staleTime` (`GC_TIMES` em `staleTimes.ts`):** o `queryClient` default define `gcTime: 15min` enquanto o maior `staleTime` (`reference`) é `5min`. Por que importa: `gcTime` controla quando uma query INATIVA sai da memória. Se igualar ao `staleTime`, o cache é evictado no instante que vira stale — navegação away-and-back sempre refetcha. Use `GC_TIMES.x` quando um hook precisar sobrescrever ambos juntos. Anti-pattern `F-H23`.

7. **`useInfiniteQuery` com filtros: `placeholderData: keepPreviousData`.** Hooks que constroem `useInfiniteQuery` DEVEM declarar `placeholderData: keepPreviousData` quando o `queryKey` inclui filtros/search — caso contrário o grid colapsa pra skeleton em cada keystroke. Todo hook que monta `useInfiniteQuery` precisa declarar isso explicitamente. Anti-pattern `F-H22`.

8. **Hooks de ações focados (mutations-only) para callers que não precisam da query.** Quando um caller só precisa de mutations (delete em ListPage, create em modal), exporte um `useXActions()` / `useCreateX()` do próprio módulo em vez de chamar `useX({ enabled: false })`. **Elimina observers fantasmas** (`entity.list` Fresh sem fetch, `entity.detail,null`) que poluíam o devtools com o pattern transicional `{ enabled: false }`. Não existe backbone compartilhado em `shared/hooks/` para isso — cada módulo escreve o seu (ver § Hooks — Decision Tree). `F-M15`.

9. **`queryKey` factory com params na assinatura.** Quando uma query depende de filtros/paginação, os params DEVEM fazer parte da assinatura do factory em `queryKeys.ts` (ver `messaging.messageStatus(id)`, `devices.qr(id)`). NUNCA estender o key inline via spread `[...queryKeys.X.Y(), params]` — quebra contrato. Anti-pattern `F-H21`.

10. **Query/mutation definida SEMPRE em hook — nunca inline no componente.** Todo `useQuery`/`useInfiniteQuery`/`useMutation` vive em `modules/<m>/presentation/hooks/` (ou `shared/hooks/` quando genuinamente cross-módulo) — componentes, páginas e contexts CONSOMEM hooks. Coreografia de UI acoplada ao ciclo da mutation (overlay de processamento, redirect, parar um poll) entra por callbacks/opções do hook (`useMessageStatus` em `messaging/presentation/hooks/` é o precedente: o `refetchInterval` para em erro terminal dentro do hook, não na página). Por quê: definição inline esconde a superfície de server-state do módulo, deixa opções (staleTime/enabled/invalidations) divergirem por call site e não é testável isoladamente. Anti-pattern `F-H29`.

11. **Um hook canônico por resource key.** Cada query key tem UM dono — o hook que define `queryFn`/`enabled`/`staleTime` (ex.: `useDevicesList` para `devices.list`, `useDeviceDetail(id)` para `devices.detail`, `useMessageStatus(id)` para `messaging.messageStatus`). Consumidores com necessidades diferentes derivam do dono (via `useMemo`/`select`) ou passam opções sancionadas (`{ enabled }`, tier override). Segunda definição do mesmo key com opções divergentes = drift silencioso de cache (o TanStack deduplica a request, mas cada observer aplica o próprio staleTime/refetch). Exceção documentada: um segundo observer com `refetchInterval` próprio sobre um key de polling compartilhado (ex.: o poll do QR no modal de conexão) — comentar o porquê no hook. Anti-pattern `F-H30`.

**Anti-pattern (não fazer):**
- Hook que retorna `device + groups + qr + messages` (kitchen sink) — quebrar em hooks focados.
- Parent page que chama várias queries de relação no mount junto com o `useDetail` — mover para dentro das sections/sub-componentes que efetivamente consomem.
- Painel/aba montando eagerly (sem `lazyMount`) sem justificativa.
- `<EntityCard>` em list page sem `onHover` para prefetch (perde-se ganho gratuito de UX).
- Mutation que invalida `queryKeys.X.all` quando dá pra ser cirúrgica (`.detail(id)`, `.list()`, `.groups(id)`) — `F-C6`.

**Anchor codes:** `F-C6` (broad invalidation — Critical), `F-C20` (kitchen-sink hook — Critical), `F-H18` (painel lazy montado eagerly — High), `F-H19` (hook sem `enabled` opcional — High), `F-H20` (staleTime literal — High), `F-H21` (factory key extension — High), `F-H22` (placeholderData ausente em useInfiniteQuery — High), `F-H23` (gcTime ≤ staleTime — High), `F-H29` (query/mutation inline em componente — High), `F-H30` (resource key com N definições de query — High), `F-M13` (eager section fetch sem `enabled` — Medium), `F-M14` (prefetch sem staleTime matching — Medium), `F-M15` (ListPage duplica list+search — Medium).

### Auth

- `AuthContext` provides `{ user, isAuthenticated, isLoading, signIn, signUp, signOut, updateProfile, resetPassword }`
- `useAuth()` to read; the session JWT lives in the httpOnly `pombo_at` cookie — JS never sees or stores it (closes XSS→session theft). `AuthSession` carries only `{ user }`.
- After login, `i18n.changeLanguage(user.language)` is called automatically
- Token refresh handled transparently by `httpClient` interceptor (cookie-only)
- **Session-termination hygiene:** every sign-out path — explicit `signOut()` AND the token-expiry handler (`setAuthExpiredHandler`) — must both `queryClient.clear()` and wipe any browser-persisted, session-scoped data (localStorage/sessionStorage keys under the `@pombo-web:` prefix, except the device preferences in `DEVICE_PREFERENCE_KEYS` — language and sidebar). Both paths call `clearSessionScopedStorage()` (`shared/utils/sessionStorageCleanup.ts`). A shared device must never leak one account's data to the next.

### i18n

- Namespaces: `common`, `auth`, `settings`, `devices`, `sandbox` (defined in `shared/i18n/index.ts` `NAMESPACES`) — add one per feature module
- File per namespace per language: `shared/i18n/locales/{pt-BR,en,es}/{namespace}.json`
- Keys use **dot notation**: `"list.title"`, `"actions.save"`, `"register.nameRequired"`
- Interpolation: `t("crud.created", { entity: tc("entities.device") })`
- Common keys (always available): `actions.*`, `status.*`, `entities.*`, `crud.*`, `errors.*`, `notify.*`, `list.*`, `forms.*`
- `useTranslation("{namespace}")` at component level; pass `t` and `tc` as separate consts when both are needed

**Rule:** every user-visible string is i18n. Adding any string requires entries in all **3** locale files.

---

## Styling System

**Absolute rule:** Chakra UI inline props only. **Never** CSS modules, styled-components, or external `.css` files.

### Semantic Tokens (mandatory — never hardcode hex)

The values live in `packages/theme/src/foundations/semantic-tokens.ts` — read them there; this table lists the families, not the colors (they change when a design is applied).

| Family | Tokens | Use |
|--------|--------|-----|
| Background | `bg.canvas` · `bg.surface` · `bg.elevated` · `bg.sunken` · `bg.muted` · `bg.hover` · `bg.active` · `bg.glass` · `bg.topbar` · `bg.overlay` | page, cards, popovers, insets, hover/active fills, frosted bars |
| Brand fills | `bg.brand.{subtle,emphasis,solid,solid-hover,solid-active}` · `bg.accent.subtle` | selected nav item, primary action |
| Component fills | `bg.switch.{track,trackEnd,thumb}` · `bg.glow.{primary,secondary,tertiary}` | the color-mode switch · decorative radial glows (auth) |
| Text | `text.primary` · `text.secondary` · `text.muted` · `text.disabled` · `text.inverse` · `text.link` · `text.brand` · `text.accent` · `text.onBrand` · `text.switchThumb` | |
| Border | `border.subtle` · `border.default` · `border.strong` · `border.brand` · `border.accent` · `border.focus` | |
| Status | `status.{success,warning,error,info,neutral,blue}.{fg,bg,border}` · `status.{success,warning,error,info}.solid` | badges, toasts (`solid` = the filled icon badge) |

Dark mode is automatic via the `_dark` half of each token's value — **never** write color-mode conditionals (`useColorMode().colorMode === "dark" ? ... : ...`) in components.

Tokens are authored in the v3 shape (`defineSemanticTokens`, nested, `{ value: { base, _dark } }`):

```ts
bg: { canvas: { value: { base: "#fafbfb", _dark: "#0b0f0e" } } },
text: { link: { value: { base: "{colors.brand.700}", _dark: "{colors.brand.300}" } } },
```

### Color Palettes

| Palette | Usage |
|---------|-------|
| `brand` | Primary actions, links, focus rings (`colorPalette="brand"` — v3 renamed `colorScheme`) |
| `accent` | Success states, secondary actions (`colorPalette="accent"`) |
| `neutral` | Text, borders, backgrounds (slate scale) |
| `purple` | Warnings / attention states |

**Hard rule (user preference):** **NEVER use yellow or orange tones.** Use `purple` for warnings, `red` for errors, `green` (`accent`) for success. This applies to backgrounds, borders, text, badges, icons, gradients — everywhere.

### Shadows

`shadow.card`, `shadow.cardHover`, `shadow.panel` (popovers, toasts), `shadow.lg` (modals), `shadow.inner` (sunken), `shadow.switchTrack` / `shadow.switchThumb`, `shadow.brandMark` / `shadow.brandMarkSm` / `shadow.authCard` (auth screens), and the focus/glow family `outline`, `input-focus`, `input-error`, `input-error-focus`, `brand-glow`, `accent-glow`. An unknown shadow name renders nothing — `tokenContract.spec.ts` fails on it.

### Spacing

Chakra scale: `1` (4px), `2` (8px), `3` (12px), `4` (16px — standard gap), `6` (24px — section padding), `8` (32px — section margin).

### Responsive

Always responsive object syntax:

```tsx
<SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
<Stack direction={{ base: "column", md: "row" }}>
<Text fontSize={{ base: "sm", md: "md" }}>
<Box display={{ base: "none", lg: "block" }}>
```

### Typography

Global font-size: `sm` (14px). FormLabel: `xs`, `600`, `gray.600`. Section heading: `sm`, `600`, `gray.700`.

### Animations (`shared/constants/animation.ts`)

- `EASE_ORGANIC = [0.22, 1, 0.36, 1]`
- `TRANSITION_FAST` (200ms), `TRANSITION_DEFAULT` (250ms), `TRANSITION_SLOW` (300ms)
- Components: `<PageTransition>` (route-level). Per-element entrances are inline `motion.create(...)`.
- MotionBox pattern: `const MotionBox = motion.create(Box)`. When the component also takes Chakra style props, re-type it — framer's `transition`/`style` and Chakra's collide:
  ```ts
  type MotionBoxProps = PropsWithChildren<
    Omit<BoxProps, keyof MotionProps> &
      Pick<MotionProps, "initial" | "animate" | "exit" | "transition" | "style">
  >;
  const MotionBox = motion.create(Box) as unknown as ComponentType<MotionBoxProps>;
  ```
- Card hover: `_hover={{ boxShadow: "shadow.cardHover", transform: "translateY(-2px)", borderColor: "brand.200" }}`
- Quick actions reveal: `<Flex opacity={0} _groupHover={{ opacity: 1 }} _focusWithin={{ opacity: 1 }} transition="opacity 0.15s ease">` — the card carries `className="group"` (Chakra v3's `_group*` conditions match the class, not `role="group"`)
- Fetching state: `<Box opacity={isFetching ? 0.5 : 1} transition="opacity 0.15s ease">`

---

## Reuse-First Catalog

### Layout & Page-Level UI (`shared/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `PageHeader` | The ONE page header (`title` + `description` + `count`/`countLabel` pill + `primaryAction` + `actions`) — use it on every list/detail page; never hand-roll a title row |
| `SectionCard` | Content section (variants: `default` / `glass` / `sunken`) |
| `StatCard` | Statistic display (label + value + hint + icon, tone-coloured) |
| `EntityCard` | List card (avatar + title + badges + meta + actions + quick actions on hover) |
| `StatusBadge` | Colored status badge |
| `InfoRow` | Label/value row inside a section |
| `EmptyState` | Empty state with icon + title + description + CTA |
| `ActionMenu` | Dropdown 3-dot menu |
| `ConfirmDialog` | Confirmation before a destructive action (`role="alertdialog"`) |
| `AppModal` | Standard modal wrapper (header + body + cancel/primary footer) |
| `SaveButton` | Save with isDirty/isSaving |
| `CopyButton` | Copy-to-clipboard with a success toast |
| `FilterBar` | Search input with clear affordance |
| `DetailPageGuard` | Loading/error/not-found wrapper for detail pages |
| `ColorModeToggle` | Light/dark switch |
| `LanguageSelector` | Locale switch (pt-BR / en / es) |
| `GlobalErrorBoundary` / `RouteErrorBoundary` | Root and per-route render-error boundaries |

**Rule:** check this catalog **before** creating any new shared UI. Duplication is a defect.

**Styleguide:** every primitive above renders, in every state, on the DEV-only route `/dev/styleguide` (`modules/development`, mounted only when `import.meta.env.DEV`; the `pombo:dev-only-modules-excluded` Vite plugin fails a production build that bundles any of its modules). A new or changed shared primitive gets a spot there, and the visual baselines in `e2e/tests/design-system/` get updated in the same change. Interactive primitives without a unique semantic selector carry a `data-cy` (the app's test-id attribute).

**Custom button variants:** the recipe's `danger` and `dangerOutline` variants are not in Chakra's generated types, and every recipe variant paints explicit tokens regardless of `colorPalette` — `colorPalette="red"` renders green, so don't pass `colorPalette` to a `Button`. A destructive primary action uses `variant={"danger" as "solid"}` (see `ConfirmDialog`, pinned by `AppModal.spec.tsx`); a destructive secondary action uses `variant={"dangerOutline" as "outline"}` (see `DeviceDetailPage`). The cast only bridges the missing typegen.

### Skeletons (`shared/components/skeletons/`)

`ListPageSkeleton`, `DetailPageSkeleton` (`profile` / `two-column` / `single`), `EntityCardSkeleton`, `FilterBarSkeleton`, `SectionCardSkeleton`. Shell-level: `AppShellSkeleton` (the `ProtectedRoute` state while the session resolves — honors the collapsed sidebar width from `SIDEBAR_WIDTH`) and `RouteContentSkeleton` (the route `Suspense` fallback; it fades in after a CSS delay, so fast loads never flash it).

### Animations (`shared/components/animations/`)

`PageTransition`. Per-element entrance animation is done inline with `motion.create(Box)` + the `TRANSITION_*` constants.

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Component | `PascalCase.tsx` | `EntityCard.tsx` |
| Props | `{Component}Props` | `EntityCardProps` |
| Hook | `use{Name}.ts` | `useDevice.ts`, `useDevices.ts` |
| Entity | `{Entity}.ts` | `Device.ts` |
| Repo interface | `{Entity}Repository.ts` | `DeviceRepository.ts` |
| Repo impl | `Http{Entity}Repository.ts` | `HttpDeviceRepository.ts` |
| Page | `{Feature}{Action}Page.tsx` | `DevicesListPage.tsx`, `DeviceDetailPage.tsx` |
| i18n namespace | `{feature}.json` | `devices.json` |
| Constants | `UPPER_SNAKE_CASE` | `TRANSITION_DEFAULT` |

**Prefixes:** `use` (hooks), `on` (callback props: `onSubmit`, `onChange`), `handle` (internal handlers: `handleSubmit`), `is`/`has` (booleans: `isLoading`, `isDirty`, `hasErrors`).

**TypeScript:** interfaces for objects + props; types for unions/intersections/aliases; **no `any`** (use `unknown` and narrow); strict mode (no implicit any, no unchecked index access).

---

## Tests

Two layers, both live in this project:

- **Unit / component (Vitest + jsdom):** co-located `*.spec.ts(x)` next to the source (`yarn workspace @pombo/web test`). Cover pure utils, hooks, and component logic; mock at the repository boundary, never `httpClient`. This is the fast inner loop — a red `yarn test` blocks the PR.
- **E2E (Playwright):** in `apps/web/e2e/`, run only when `apps/web/**` changed. Details below.

### E2E (Playwright)

- **Location:** `apps/web/e2e/`
  - `tests/` — specs by module (`auth/`, `devices/`, `messaging/`, ... — today a single flat `auth.spec.ts` ships as the template; new specs follow the per-module layout in `patterns/e2e.md`)
  - `pages/` — Page Objects (`LoginPage.ts`, `DevicesListPage.ts`, `components/Sidebar.ts`, ... — create on first use)
  - `fixtures/` — `auth.fixture.ts` (auto-login), `api.fixture.ts` (data setup)
  - `global.setup.ts` — pre-test setup
- **Selectors priority:** `getByRole` > `getByLabel` > `getByText` > `getByPlaceholder` > `getByTestId` (last resort). **Never** CSS class selectors; **never** XPath.
- **Auth:** use the `auth.fixture` (`authenticatedPage`); never log in manually in each test
- **Data isolation:** unique data per test (timestamp/UUID); cleanup in `afterEach` / via API fixture
- **Waits:** `waitForURL`, `waitForSelector`, `expect().toBeVisible()` — never `waitForTimeout` except for explicit debounce (300ms search, 1500ms auto-save)

See `/test-e2e` skill for the full template.

---

## Adding a New CRUD Module — Order of Operations

1. **Entity type** — `modules/{feature}/domain/entities/{Entity}.ts`
2. **Repository interface** — `modules/{feature}/domain/repositories/{Entity}Repository.ts` (name the methods after the domain action)
3. **HTTP repository** — `modules/{feature}/infrastructure/repositories/Http{Entity}Repository.ts`
4. **DI registration** — add to `core/di/repositories.ts`
5. **Query keys** — add namespace to `core/query/queryKeys.ts`
6. **Module hooks** — `modules/{feature}/presentation/hooks/use{Entities}.ts`: one `useQuery` per resource key plus its mutations. Every `useQuery`/`useMutation` lives here, never inline in a page (`F-H29`)
7. **List page** — `pages/{Feature}ListPage.tsx` (`PageHeader` + `FilterBar` + cards + `ListPageSkeleton` + `EmptyState`)
8. **Create modal** — `components/{Entity}CreateModal.tsx` (`AppModal` + `useFormState` or RHF)
9. **Detail page** — `pages/{Feature}DetailPage.tsx` (`useDetailPageController` + `SectionCard` + `DetailPageGuard`)
10. **Route paths** — add to `app/router/RoutePaths.ts`
11. **Router** — a `<Route>` under `ProtectedLayout` in `AppRouter.tsx`, with the page as a `lazyWithRetry()` chunk
12. **i18n** — create `shared/i18n/locales/{pt-BR,en,es}/{feature}.json`; register namespace in `shared/i18n/index.ts`
13. **Sidebar** — add nav item
14. **Barrel** — `modules/{feature}/index.ts` exporting the entity types + public hooks + pages (MANDATORY)

**Canonical reference:** `modules/devices/` is the most complete module (list + detail + modals + action hooks) — copy its shape.

**Cross-reference:** see `.claude/patterns/code-review-checklist.md` for what gets flagged in review.
