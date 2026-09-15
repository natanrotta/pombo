# Frontend Architecture — Canonical Lifecycle (Authority)

**This document is the single source of truth for how data flows from a user action → API → render in the frontend.**

Every frontend skill (`/frontend`, `/fullstack`, `/ui-design`, `/code-review`, `/test-e2e`) MUST defer to this document. If a skill contradicts this file, this file wins. If you discover a divergence between this file and the actual code, update this file.

---

## Stack

- **Bundler:** Vite
- **Framework:** React 18 (functional + hooks, no class components)
- **Router:** React Router v6 (config-based, lazy + Suspense)
- **UI:** Chakra UI 2.8 with custom theme + semantic tokens
- **State (server):** TanStack Query v5
- **State (global UI):** React Context only (Auth, Sidebar) — **no Redux, no Zustand**. If a feature needs its own navigation/UI state (never server data — that lives in TanStack Query), use a small feature-scoped Context under `presentation/context/` and document why.
- **Forms (validated):** react-hook-form + Zod (lazy schema builders for i18n)
- **Forms (simple modals):** `useFormState` hook
- **HTTP:** Axios with interceptors (session cookie ride-along, refresh, CSRF, language, envelope unwrap). If you ever need a streaming transport (SSE — e.g. live device/message events), Axios can't stream in the browser — use native `fetch` and re-attach `credentials: "include"` + the CSRF header (`getCsrfToken`) manually.
- **Animations:** Framer Motion (`motion(Box)` pattern, organic easing)
- **i18n:** react-i18next (3 locales: pt-BR default, en, es). Only **pt-BR** (the fallback) is bundled in the entry chunk; en/es load on demand as one lazy chunk each (see `shared/i18n/index.ts` + `locales/{en,es}/index.ts`).
- **Tests:** Vitest (co-located `*.spec.ts(x)` unit/component tests, `jsdom`) + Playwright (e2e in `apps/web/e2e/`)
- **TypeScript:** strict, no `any` (use `unknown` and narrow)

---

## Layer Structure (`apps/web/src/`)

```
app/                              # App-level setup (one-time)
  router/AppRouter.tsx            # Lazy + Suspense + guards
  router/RoutePaths.ts            # All paths centralized — no string literals in components
  theme/foundations/semantic-tokens.ts  # bg.*, text.*, border.*, status.* (with _dark variants)
  theme/components/               # Chakra component overrides
  providers/                      # AppProviders (QueryClient, Chakra, i18n, Auth)

core/                             # Cross-cutting infrastructure
  di/repositories.ts              # Singleton repository registry
  domain/CrudRepository.ts        # Base repository interface (extend in feature repos)
  http/httpClient.ts              # Axios + interceptors (refresh, envelope unwrap, CSRF, language)
  errors/AppError.ts              # message, code, statusCode, details
  query/queryClient.ts            # TanStack QueryClient config
  query/queryKeys.ts              # ALL query keys (factory pattern, hierarchical)
  query/entityQueryKeys.ts        # Generic key types

modules/{feature}/                # Feature modules (one per domain — account, auth, devices, messaging, settings)
  domain/
    entities/{Entity}.ts          # Plain TS interface + Create/Update input types
    repositories/{Entity}Repository.ts  # extends CrudRepository<T, TC, TU> [+ BulkDeletable]
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
    ui/                           # AppModal, EntityCard, ListPageLayout, EmptyState, ProfileHeader, ...
    forms/                        # FormField, SelectField, DateField, RichTextField, PasswordField, ...
    layout/                       # AppShell, Sidebar, Topbar
    skeletons/                    # ListPageSkeleton, DetailPageSkeleton, ...
    animations/                   # FadeIn, StaggerContainer, StaggerItem
  hooks/                          # useEntityList, useEntityDetail, useListPageController,
                                  #   useDetailPageController, useFormState, useAutoSave,
                                  #   useNotify, useBulkSelection, useConfirm, useDebounce,
                                  #   useUnsavedChangesGuard, useInfiniteListPage, useServerSearch
  contexts/                       # SidebarContext (global UI state)
  i18n/locales/{pt-BR,en,es}/     # One JSON per namespace
  utils/                          # date, phone, document, mergeEdits, pagination
  constants/                      # Animation constants (EASE_ORGANIC, TRANSITION_*), enums
  types/                          # PaginationParams, PaginatedResponse, ...
```

**Dependency rule:** `domain` ← `infrastructure` ← `presentation`. Components never import from `infrastructure` directly — always go through `core/di/repositories.ts` and a hook.

---

## Canonical Data-Fetching → Render Lifecycle

For "user opens device detail" (illustrative — mirrors `modules/devices`):

1. `<Route path="/devices/:id" element={<DeviceDetailPage />} />` matches
2. `<DeviceDetailPage />` mounts; `useParams()` reads `id`
3. `useDeviceDetail(id)` is called — the module's canonical detail hook (`modules/devices/presentation/hooks/useDevices.ts`); for a CRUD entity it wraps `useEntityDetail({ id, queryKey: queryKeys.devices, repository: repositories.device })`
4. TanStack Query checks cache for `queryKeys.devices.detail(id)`; if stale or missing → `queryFn` runs
5. `queryFn` → `repositories.device.getById(id)` → `HttpDeviceRepository.getById(id)` → `httpClient.get("/devices/" + id)`
6. Axios request interceptor: the session rides the httpOnly `pombo_at` cookie automatically (`withCredentials: true`) — JS never holds the JWT; the interceptor attaches `X-CSRF-Token` (from cookie) and `Accept-Language` (from localStorage). The only Bearer header still built by hand is the short-lived scoped `email:verify` token on the e-mail verification routes.
7. API responds `{ ok: true, data: { id, name, ... } }`
8. Axios response interceptor unwraps: returns `data` directly (or throws `AppError` on `{ ok: false }` / network error)
9. TanStack Query caches under `queryKeys.devices.detail(id)`; component re-renders with `entity` populated
10. `<DetailPageGuard isLoading={isLoading} error={error} entity={entity}>` decides: skeleton / error / not-found / children
11. On success → `ProfileHeader`, `EditableInfoGrid`, `AppTabs` render the content
12. On user edit → `useDetailPageController` updates local state, marks `isDirty=true`, debounces 1500ms → `useAutoSave` triggers `onSave(localData)` → `update.mutateAsync()` → repository PUT → on success: `setQueryData(detail(id), updated)` + `invalidateQueries(search())` + `showAutoSaved()`

---

## Patterns by Layer

### Entity (Domain)

```typescript
// modules/devices/domain/entities/Device.ts
export type DeviceStatus = "DISCONNECTED" | "QR_PENDING" | "CONNECTED" | /* ... mirror the API enum */ string;

export interface Device {
  id: string;
  accountId: string;
  name: string;
  status: DeviceStatus;
  identifier: string | null;    // paired WhatsApp number once CONNECTED
  createdAt: string;            // ISO string from API; convert to Date only at render boundary
  updatedAt: string;
}

export interface CreateDeviceInput { name: string; }
export interface UpdateDeviceWebhooksInput { /* one nullable URL per event */ }
```

**Rules:** plain TS interfaces (not classes); dates as ISO strings (matches API DTO exactly); separate `Create*Input` (required) and `Update*Input` (all-optional with `| null` for clearable). Field names mirror backend response DTO 1:1.

### Repository Interface (Domain)

```typescript
// modules/devices/domain/repositories/DeviceRepository.ts
import type { CrudRepository } from "@/core/domain/CrudRepository";

export interface DeviceRepository
  extends CrudRepository<Device, CreateDeviceInput, UpdateDeviceWebhooksInput> {
  getQr(id: string): Promise<DeviceQr>;
  connect(id: string): Promise<void>;
  disconnect(id: string): Promise<void>;
}
```

**Rules:** always extend `CrudRepository` (gives `list/listPaginated/getById/create/update/delete` for free); add `BulkDeletable` if `bulkDelete(ids)` exists; only add custom methods for actions/relations (`connect`, `getQr`, `linkX`, etc.).

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
| Full list (no pagination) + optimistic delete | `useEntityList` | `shared/hooks/useEntityList.ts` |
| Paginated list with debounced search | `useServerListPage` (via `useInfiniteListPage`) | `shared/hooks/useInfiniteListPage.ts` |
| Full list page (search + bulk + delete confirm + create modal) | `useListPageController` | `shared/hooks/useListPageController.ts` |
| Single entity CRUD | `useEntityDetail` | `shared/hooks/useEntityDetail.ts` |
| Detail page with auto-save (1500ms) + dirty + validation | `useDetailPageController` | `shared/hooks/useDetailPageController.ts` |
| Modal/standalone form (simple) | `useFormState` | `shared/hooks/useFormState.ts` |
| Validated form (login, register, complex) | `useForm` (RHF) + `zodResolver(buildXSchema())` | direct |
| Toast | `useNotify` (`showSuccess`, `showError`, `showInfo`, `showAutoSaved`) | `shared/hooks/useNotify.tsx` |
| Bulk selection state | `useBulkSelection` | `shared/hooks/useBulkSelection.ts` |
| Confirm dialog state | `useConfirm` | `shared/hooks/useConfirm.ts` |
| Unsaved-changes nav guard | `useUnsavedChangesGuard(isDirty)` | `shared/hooks/useUnsavedChangesGuard.ts` |
| Debounce a value | `useDebounce(value, 300)` | `shared/hooks/useDebounce.ts` |
| Centralized error handling | `useErrorHandler()` → `handleError(error, fallback)` | `core/query/useErrorHandler.ts` |

```typescript
// modules/devices/presentation/hooks/useDevices.ts (canonical — real exports: useDevicesList, useDeviceDetail,
// useCreateDevice, useDeleteDevice, useConnectDevice, useDisconnectDevice, useDeviceQr, useDeviceGroups, useUpdateDeviceWebhooks)
export function useDeviceDetail(id?: string) {
  const base = useEntityDetail<Device, CreateDeviceInput, UpdateDeviceWebhooksInput>({
    id, repo: repositories.device, keys: queryKeys.devices,
    errorMessages: errorMessages.crud("device"),
  });
  // Add custom action queries/mutations here if needed (connect, disconnect, qr poll)
  return base;
}
```

### Page Component (Composition)

Pages own queries, controllers, modal state, and orchestration. Sub-components are dumb and receive `value`, `onChange`, `onClick`.

```typescript
export default function DevicesListPage() {
  const { t } = useTranslation("devices");
  const ctrl = useListPageController({
    queryKey: queryKeys.devices.list(),
    fetchFn: (params) => repositories.device.listPaginated(params),
    deleteFn: (id) => repositories.device.delete(id),
    bulkDeleteFn: (ids) => repositories.device.bulkDelete(ids),
    entityLabel: { singular: t("entity"), plural: t("entityPlural") },
  });
  return <ListPageLayout {...ctrl} renderCard={(item) => <EntityCard ... />} />;
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

- **Config-based** with `lazy()` + `Suspense` for every route
- Guards: `ProtectedRoute` (requires auth), `PublicOnlyRoute` (redirects authenticated)
- All paths in `RoutePaths.ts` — never hardcode `"/devices/:id"` in a component; use `ROUTE_PATHS.deviceDetail.replace(":id", id)`
- Wrap protected routes in `withAppShell()` (applies `AppShell` + `ProtectedRoute` + `RouteErrorBoundary`)

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

**Form primitives (`shared/components/forms/`):** Always reuse `FormField`, `SelectField`, `DateField`, `MultiSelectField`, `PasswordField`, `RichTextField`, `DocumentField`, `PhoneField`, `MonetaryField`, `NumberField`, `TextAreaField`, `ColorPicker`, `FileUploadField`, `SearchField`, `TimeField` — **do not** wrap raw Chakra `<Input>` in feature code.

### Modals

- Controlled by parent state via `useDisclosure()` from Chakra
- Wrap in `<AppModal isOpen onClose title primaryActionLabel onPrimaryAction isPrimaryLoading>` — gives standard footer (cancel + primary)
- **No** global modal store; **no** URL sync for modals (modals are ephemeral, not bookmarkable)
- Sticky headers on long modals; `size="md"` default, `"lg"` for forms with many fields

### Loading / Error / Empty States

| Surface | Use |
|---------|-----|
| Detail page | `<DetailPageGuard isLoading error entity skeletonVariant="profile" notFoundMessage>{children}</DetailPageGuard>` |
| List page | `<ListPageLayout isEmpty emptyTitle emptyDescription emptyActionLabel onEmptyAction />` |
| Section / card | `<SectionCardSkeleton />`, `<StatCardSkeleton />`, `<EntityCardSkeleton />` |
| Manual empty | `<EmptyState icon title description actionLabel onAction />` |
| Manual error | `useNotify().showError(error, fallback)` toast |
| Render error | `<RouteErrorBoundary>` (per route via `withAppShell`); `<GlobalErrorBoundary>` (root) |

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

`useEntityList` already implements optimistic delete:

```typescript
onMutate: async (deletedId) => {
  await queryClient.cancelQueries({ queryKey: keys.list() });
  const previous = queryClient.getQueryData<T[]>(keys.list());
  queryClient.setQueryData<T[]>(keys.list(), (prev) => prev?.filter((x) => x.id !== deletedId) ?? []);
  return { previous };
},
onError: (_err, _id, ctx) => { if (ctx?.previous) queryClient.setQueryData(keys.list(), ctx.previous); },
```

Use this pattern only when the operation is fast and rollback is cheap; otherwise prefer `invalidate-then-refetch` for correctness.

### Data-fetching scope, lazy mount, and prefetch

**Princípio:** o usuário só paga por dados que está prestes a ver.

1. **Lazy mount via tab boundary.** Toda `<AppTabs>` é lazy por default (`isLazy lazyBehavior="keepMounted"`). Componentes dentro de um painel de aba SÓ disparam queries quando o usuário clica naquela aba pela primeira vez (mantém montado depois — não refetch ao retornar). Opt-out (`isLazy={false}`) só com motivo documentado.

2. **Section-scoped fetch (não kitchen-sink).** Cada section/aba é responsável pelo próprio fetch. NÃO chamar hooks de relação no parent e passar dados por prop — quebra o lazy boundary. Padrão correto: `<DeviceWebhooksSection deviceId={id} />` chama o hook que precisa internamente. Modais auxiliares (`LinkEntityModal`) também devem viver dentro da section que os usa.

3. **Hooks focados (não kitchen-sink).** Hook de feature deve encapsular UMA query principal + suas mutations relacionadas. Se um hook tem >2 `useQuery` distintos, está virando kitchen-sink — quebrar em hooks menores. Aceitar `{ enabled }` opcional para callers fora de tab que precisam suspender manualmente (ex: uma página chama `useDeviceDetail(id)` só pelo breadcrumb name).

4. **Prefetch on hover.** Em list pages, usar `usePrefetchEntity({ repo, keys })` para retornar `prefetch(id)`. Passar para `<EntityCard onHover={() => prefetch(item.id)}>`. Pre-aquece o cache no hover/focus — sem custo se o user não clicar (TanStack Query gerencia gc/stale, segundo prefetch dentro do staleTime é no-op).

5. **Stale tiers (`STALE_TIMES` em `core/query/staleTimes.ts`):**
   - `default: 60_000` — entidades transacionais (device, api token, perfil). Match com o `queryClient` default; passar é opcional.
   - `reference: 5*60_000` — reference data (lookups, enums, settings). Mudam raramente, evita refetch agressivo.
   - `volatile: 15_000` — dados muito dinâmicos (status de conexão, listas que dependem do socket ao vivo — ex.: grupos do device, `retry: false` + estado de erro próprio).
   - `subscription: 30_000` — polling de status (entre default e volatile). O poll de status de mensagem e o poll do QR usam `refetchInterval` próprio — e param (`return false`) em erro terminal.
   Hooks compartilhados (`useEntityList`, etc.) aceitam `staleTime?: number` opcional para escolher o tier.

6. **`gcTime` ≥ 3× `staleTime` (`GC_TIMES` em `staleTimes.ts`):** o `queryClient` default define `gcTime: 15min` enquanto o maior `staleTime` (`reference`) é `5min`. Por que importa: `gcTime` controla quando uma query INATIVA sai da memória. Se igualar ao `staleTime`, o cache é evictado no instante que vira stale — navegação away-and-back sempre refetcha. Use `GC_TIMES.x` quando um hook precisar sobrescrever ambos juntos. Anti-pattern `F-H23`.

7. **`useInfiniteQuery` com filtros: `placeholderData: keepPreviousData`.** Hooks que constroem `useInfiniteQuery` direto (sem passar pelo `useInfiniteListPage`) DEVEM declarar `placeholderData: keepPreviousData` quando o `queryKey` inclui filtros/search — caso contrário o grid colapsa pra skeleton em cada keystroke. `useInfiniteListPage` já cobre — hooks custom precisam adicionar manualmente. Anti-pattern `F-H22`.

8. **Hooks de ações focados (mutations-only) para callers que não precisam da query.** Padrão definitivo: quando um caller só precisa de mutations (delete em ListPage, create em modal), consumir `useXActions()` / `useCreateX()` em vez de `useX({ enabled: false })`. Backbone compartilhado: `useEntityActions` e `useEntityCreate` em `shared/hooks/` — implementam mesma semântica de optimistic update + cross-key invalidation dos hooks com query. **Elimina observers fantasmas** (`entity.list` Fresh sem fetch, `entity.detail,null`) que poluíam o devtools com o pattern transicional `{ enabled: false }`. `F-M15`.

9. **`queryKey` factory com params na assinatura.** Quando uma query depende de filtros/paginação, os params DEVEM fazer parte da assinatura do factory em `queryKeys.ts` (ver `messaging.messageStatus(id)`, `devices.qr(id)`). NUNCA estender o key inline via spread `[...queryKeys.X.Y(), params]` — quebra contrato. Anti-pattern `F-H21`.

10. **Query/mutation definida SEMPRE em hook — nunca inline no componente.** Todo `useQuery`/`useInfiniteQuery`/`useMutation` vive em `modules/<m>/presentation/hooks/` (ou `shared/hooks/` quando genuinamente cross-módulo) — componentes, páginas e contexts CONSOMEM hooks. Coreografia de UI acoplada ao ciclo da mutation (overlay de processamento, redirect, parar um poll) entra por callbacks/opções do hook (`useMessageStatus` em `messaging/presentation/hooks/` é o precedente: o `refetchInterval` para em erro terminal dentro do hook, não na página). Por quê: definição inline esconde a superfície de server-state do módulo, deixa opções (staleTime/enabled/invalidations) divergirem por call site e não é testável isoladamente. Anti-pattern `F-H29`.

11. **Um hook canônico por resource key.** Cada query key tem UM dono — o hook que define `queryFn`/`enabled`/`staleTime` (ex.: `useDevicesList` para `devices.list`, `useDeviceDetail(id)` para `devices.detail`, `useMessageStatus(id)` para `messaging.messageStatus`). Consumidores com necessidades diferentes derivam do dono (via `useMemo`/`select`) ou passam opções sancionadas (`{ enabled }`, tier override). Segunda definição do mesmo key com opções divergentes = drift silencioso de cache (o TanStack deduplica a request, mas cada observer aplica o próprio staleTime/refetch). Exceção documentada: um segundo observer com `refetchInterval` próprio sobre um key de polling compartilhado (ex.: o poll do QR no modal de conexão) — comentar o porquê no hook. Anti-pattern `F-H30`.

**Anti-pattern (não fazer):**
- Hook que retorna `device + groups + qr + messages` (kitchen sink) — quebrar em hooks focados.
- Parent page que chama várias queries de relação no mount junto com o `useDetail` — mover para dentro das sections/sub-componentes que efetivamente consomem.
- `<AppTabs>` com `isLazy={false}` sem justificativa.
- `<EntityCard>` em list page sem `onHover` para prefetch (perde-se ganho gratuito de UX).
- Mutation que invalida `queryKeys.X.all` quando dá pra ser cirúrgica (`.detail(id)`, `.list()`, `.groups(id)`) — `F-C6`.

**Anchor codes:** `F-C6` (broad invalidation — Critical), `F-C20` (kitchen-sink hook — Critical), `F-H18` (eager AppTabs — High), `F-H19` (hook sem `enabled` opcional — High), `F-H20` (staleTime literal — High), `F-H21` (factory key extension — High), `F-H22` (placeholderData ausente em useInfiniteQuery — High), `F-H23` (gcTime ≤ staleTime — High), `F-H29` (query/mutation inline em componente — High), `F-H30` (resource key com N definições de query — High), `F-M13` (eager section fetch sem `enabled` — Medium), `F-M14` (prefetch sem staleTime matching — Medium), `F-M15` (ListPage duplica list+search — Medium).

### Auth

- `AuthContext` provides `{ user, isAuthenticated, isLoading, signIn, signUp, signOut, updateProfile, resetPassword }`
- `useAuth()` to read; the session JWT lives in the httpOnly `pombo_at` cookie — JS never sees or stores it (closes XSS→session theft). `AuthSession` carries only `{ user }`.
- After login, `i18n.changeLanguage(user.language)` is called automatically
- Token refresh handled transparently by `httpClient` interceptor (cookie-only)
- **Session-termination hygiene:** every sign-out path — explicit `signOut()` AND the token-expiry handler (`setAuthExpiredHandler`) — must both `queryClient.clear()` and wipe any browser-persisted, session-scoped data (localStorage/sessionStorage keys under the `@pombo-web:` prefix, except the language). A shared device must never leak one account's data to the next.

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

| Category | Token | Light → Dark |
|----------|-------|--------------|
| Background | `bg.canvas` | `#f3f7fc` → `#0b1220` (page bg) |
| Background | `bg.surface` | `#ffffff` → `#121a2b` (card/panel) |
| Background | `bg.elevated` | `#ffffff` → elevated |
| Background | `bg.sunken` | `#f0f4f8` (inset) |
| Background | `bg.glass` | `rgba(255,255,255,0.80)` (frosted) |
| Text | `text.primary` | `#1f2937` → `#e6eaf2` |
| Text | `text.secondary` | `#4b5563` → `#a9b3c6` |
| Border | `border.subtle` | `rgba(15,23,42,0.07)` |
| Border | `border.default` | `rgba(15,23,42,0.12)` |
| Border | `border.strong` | `rgba(15,23,42,0.20)` |
| Status | `status.success.fg` | `green.600` → `green.300` |
| Status | `status.error.fg` | `red.600` → `red.300` |

Dark mode is automatic via `_dark` keys in the token definitions — **never** write color-mode conditionals (`useColorMode().colorMode === "dark" ? ... : ...`) in components.

### Color Palettes

| Palette | Usage |
|---------|-------|
| `brand` | Primary actions, links, focus rings (`colorScheme="brand"`) |
| `accent` | Success states, secondary actions (`colorScheme="accent"`) |
| `neutral` | Text, borders, backgrounds (slate scale) |
| `purple` | Warnings / attention states |

**Hard rule (user preference):** **NEVER use yellow or orange tones.** Use `purple` for warnings, `red` for errors, `green` (`accent`) for success. This applies to backgrounds, borders, text, badges, icons, gradients — everywhere.

### Shadows

`card`, `card-hover`, `panel`, `lg` (modals), `inner` (sunken), `brand-glow`, `accent-glow`, `input-focus`, `input-error`.

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
- Components: `<FadeIn delay y>`, `<StaggerContainer staggerDelay>`, `<StaggerItem>`
- MotionBox pattern: `const MotionBox = motion(Box)`
- Card hover: `_hover={{ boxShadow: "card-hover", transform: "translateY(-2px)", borderColor: "brand.200" }}`
- Quick actions reveal: `<Flex opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s ease">`
- Fetching state: `<Box opacity={isFetching ? 0.5 : 1} transition="opacity 0.15s ease">`

---

## Reuse-First Catalog

### Layout & Page-Level UI (`shared/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `ListPageLayout` | Full list page (search + filter + grid + pagination + empty + delete confirm) |
| `PageHeader` | The ONE page header (`title` + `description` + `count`/`countLabel` pill + `primaryAction` + `actions`) — use it on every list/detail/single-page module; never hand-roll a title row |
| `AppTabs` | Tab nav within detail pages (optional URL sync) |
| `AppBreadcrumb` | Breadcrumb nav |
| `ProfileHeader` | Detail page header with avatar + meta + breadcrumbs |
| `EntityCard` | List card (avatar + title + badges + meta + actions + quick actions on hover) |
| `SectionCard` | Content section (variants: `default` / `glass` / `sunken`) |
| `StatCard` | Statistic display |
| `EntityAvatar` | Avatar with initials fallback |
| `StatusBadge` | Colored status badge |
| `TagBadge` | Tag display |
| `EmptyState` | Empty state with icon + title + description + CTA |
| `ActionMenu` | Dropdown 3-dot menu |
| `BulkActionBar` | Floating bar during bulk select |
| `ConfirmDialog` | Confirmation before destructive action |
| `AppModal` | Standard modal wrapper |
| `LinkEntityModal` | Generic link/search modal |
| `SaveButton` | Save with isDirty/isSaving |
| `EditableInfoGrid` | Grid of editable fields (text, date, select, textarea, readonly, document, phone) |
| `DataTable` | Generic table |
| `PaginationControls` | Pagination footer |
| `FilterBar` | Search + tag filter + actions |
| `DetailPageGuard` | Loading/error/not-found wrapper for detail pages |

**Rule:** check this catalog **before** creating any new shared UI. Duplication is a defect.

### Skeletons (`shared/components/skeletons/`)

`ListPageSkeleton`, `DetailPageSkeleton` (`profile` / `two-column` / `single`), `EntityCardSkeleton`, `FilterBarSkeleton`, `SectionCardSkeleton`, `StatCardSkeleton`, `DashboardSkeleton`.

### Animations (`shared/components/animations/`)

`FadeIn`, `StaggerContainer`, `StaggerItem`.

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
2. **Repository interface** — `modules/{feature}/domain/repositories/{Entity}Repository.ts` (extends `CrudRepository`)
3. **HTTP repository** — `modules/{feature}/infrastructure/repositories/Http{Entity}Repository.ts`
4. **DI registration** — add to `core/di/repositories.ts`
5. **Query keys** — add namespace to `core/query/queryKeys.ts`
6. **List hook** — `modules/{feature}/presentation/hooks/use{Entities}.ts` (uses `useEntityList` or custom)
7. **Detail hook** — `modules/{feature}/presentation/hooks/use{Entity}.ts` (uses `useEntityDetail` + custom relations)
8. **List page** — `pages/{Feature}ListPage.tsx` (`useListPageController` + `ListPageLayout` + `EntityCard`)
9. **Create modal** — `components/{Entity}CreateModal.tsx` (`AppModal` + `useFormState` or RHF)
10. **Detail page** — `pages/{Feature}DetailPage.tsx` (`useDetailPageController` + `EditableInfoGrid` + `DetailPageGuard`)
11. **Route paths** — add to `app/router/RoutePaths.ts`
12. **Router** — add to `AppRouter.tsx` with `withAppShell()` + `lazy()`
13. **i18n** — create `shared/i18n/locales/{pt-BR,en,es}/{feature}.json`; register namespace in `shared/i18n/index.ts`
14. **Sidebar** — add nav item

**Canonical reference:** `modules/devices/` is the most complete module (list + detail + modals + action hooks) — copy its shape.

**Cross-reference:** see `.claude/patterns/code-review-checklist.md` for what gets flagged in review.
