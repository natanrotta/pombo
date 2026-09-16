# Task Spec — web-rebuild-fase-1-limpeza

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (todas as fases do roadmap nesta branch, um commit por fase) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Low |
| **Specialist** | /frontend |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 1 + Apêndice C (o roadmap é o output de triagem desta fase) |

## 1. Goal
Encolher o `apps/web` antes do redesign: tirar código, dependências e resíduos de boilerplate que nenhuma tela usa, e fechar quatro furos pequenos de higiene (nav duplicada, aliases triplicados, reporte de erro de rota, limpeza de storage no sign-out) — sem nenhuma mudança visível.

## 2. Scope
**In:**
- Deletar: `RichTextField` (+spec), `normalizeTiptapHtml`, CSS `.rich-text-*` do `globalCss`, chaves i18n `forms.richText.*` (3 locales); `useBulkSelection`, `useInfiniteScrollSentinel` (+specs); `shared/utils/{string,fieldValue,monetary,document,transcriptHtml,mergeEdits,pagination}` (+specs); `shared/types/pagination`; token `shadows.recording-glow`; token `accent.gold`; `queryKeys.{settings,auth,health}`.
- Remover deps `@tiptap/*` (5), `jspdf`, `jspdf-autotable`, `dompurify`.
- `core/errors/errorCodes.ts` só com os códigos que a UI usa; comentários residuais (`HttpCopilotRepository`, `/invite`, `/templates/:id`, `buildPatientDocumentFilename`, tiptap/jspdf) corrigidos; `PageTransition` sem o mecanismo de chave estável vazio.
- `SettingsRepository`/`HttpSettingsRepository` vazios saem do módulo e do DI.
- `MobileBottomNav` consome `navigationSections`.
- Um único mapa de aliases (`apps/web/aliases.ts`) usado por `vite.config.ts` e `vitest.config.ts` (`@assets` passa a existir no Vitest); `tsconfig.paths` reduzido a `@/*` + `@assets/*`.
- `.playwright/` no `.gitignore` e o report commitado sai do git.
- `e2e/global.setup.ts` checa `/devices` (rota real) em vez de `/dashboard`.
- `RouteErrorBoundary` reporta ao `errorReporter` (helper compartilhado com o `GlobalErrorBoundary`).
- Sign-out (explícito e expiração) limpa todo `@pombo-web:*` exceto preferências do dispositivo (idioma, sidebar); a chave do sidebar ganha o prefixo.
- `apps/web/README.md` reescrito para o estado real; docs de patterns sem referência ao código deletado.

**Out (deferred):**
- Mudança visual de qualquer tipo (Fase 3+).
- `@pombo/shared-types` / enum de erros compartilhado (Fase 2).
- Barrel `icons/index.ts` com nomes legados (Fase 5).
- i18n órfão fora de `forms.richText` (varredura própria, Fase 10).

## 3. Acceptance criteria
- **AC-1** — `yarn type-check`, `yarn lint`, `yarn test`, `yarn build:web` e `yarn test:e2e` (web) verdes.
- **AC-2** — `grep -rniE "tiptap|jspdf|dompurify|COPILOT_|HttpCopilotRepository|/templates/|prosemirror|rich-?text" apps/web --exclude-dir=node_modules` vazio (fora do lockfile).
- **AC-3** — Nenhum dos arquivos/símbolos da lista In existe; nenhuma das deps está em `apps/web/package.json`.
- **AC-4** — `vitest.config.ts` e `vite.config.ts` importam o mesmo mapa de aliases (que inclui `@assets`).
- **AC-5** — `RouteErrorBoundary` reporta um crash de render ao `errorReporter` com severidade `error` e não reporta erro de chunk (spec).
- **AC-6** — Após sign-out (explícito ou expiração) nenhuma chave `@pombo-web:*` sobra além de idioma e sidebar (spec do util).
- **AC-7** — `MobileBottomNav` não declara itens próprios; os 4 itens vêm de `navigationSections`.
- **AC-8** — Zero mudança visível: as 11 páginas renderizam igual; o `auth.spec.ts` passa sem mudança.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Reporte de crash de render | `GlobalErrorBoundary.componentDidCatch` | `shared/components/ui/GlobalErrorBoundary.tsx` | extrair `reportRenderError` para `shared/lib/error-reporter.ts` e usar nos dois |
| Itens de navegação | `navigationSections` | `shared/components/layout/navigation.ts` | consumir no bottom nav |
| Chaves de storage | `STORAGE_KEYS` | `shared/constants/storageKeys.ts` | derivar a lista de preferências do dispositivo |

## 6. Files plan
**Create:** `apps/web/aliases.ts`, `src/shared/utils/sessionStorageCleanup.ts` (+spec), `src/shared/components/ui/RouteErrorBoundary.spec.tsx`, esta spec.
**Delete:** os arquivos listados em In.
**Modify:** `package.json`, `src/shared/contexts/SidebarContext.tsx`, `src/shared/components/layout/navigation.ts`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `.gitignore` (raiz), `e2e/global.setup.ts`, `README.md`, `src/app/theme/{index,foundations/shadows,foundations/semantic-tokens}.ts`, `src/core/query/queryKeys{,.spec}.ts`, `src/core/errors/{errorCodes,AppError}.ts`, `src/core/query/queryClient.ts`, `src/core/http/httpClient.ts`, `src/core/di/repositories.ts`, `src/shared/components/animations/PageTransition.tsx`, `src/shared/components/layout/MobileBottomNav.tsx`, `src/shared/components/ui/{Route,Global}ErrorBoundary.tsx`, `src/shared/lib/error-reporter.ts`, `src/shared/constants/storageKeys.ts`, `src/modules/auth/infrastructure/repositories/HttpAuthRepository.ts`, 3× `common.json`, `.claude/patterns/frontend.md`, `.claude/commands/{frontend,fullstack}.md`, `yarn.lock`.

## 7. Test plan
AC-5 → `RouteErrorBoundary.spec.tsx`. AC-6 → `sessionStorageCleanup.spec.ts`. AC-4 → revisão dos dois configs + `yarn test` verde. AC-1/AC-8 → gates + `auth.spec.ts` inalterado + checagem manual das telas.

## 8. Diff budget
~4 arquivos criados, ~25 deletados, ~30 modificados. Zero dependência nova. Nenhuma mudança de comportamento visível.

## Decisions log
- [2026-09-16] Fase executada direto do roadmap (que já foi a triagem), sem nova rodada de `/triage`; todas as fases na mesma branch por pedido do usuário.
- [2026-09-16] `STALE_TIMES`/`GC_TIMES` **ficam**: `F-H20`/`F-H23` exigem os tiers, e as Fases 7–9 vão usá-los. Em vez de deletar, o `queryClient` passa a consumir `STALE_TIMES.default` (literal `60_000` hoje).
- [2026-09-16] A regra de sign-out do `patterns/frontend.md` ("todo `@pombo-web:` exceto idioma") ganha o sidebar como segunda preferência do dispositivo: ele não é dado de conta, e prefixá-lo sem essa exceção faria o sidebar reabrir a cada logout. A chave antiga `sidebar-collapsed` não é migrada (perda única de uma preferência cosmética).
- [2026-09-16] Babysit: auditor 0 Critical/High (1 Low aplicado: comentário do `AppError`). Revisor 0 Critical/High; o Medium (renomear a chave do sidebar sem leitura de compatibilidade quebraria o AC-8 para quem já tinha colapsado) foi corrigido com fallback de leitura da chave antiga + remoção na próxima escrita; AC-4 reescrito para o que é verificável (a prova de que `@assets` resolve é o `vite build` do AC-1); nota sobre o match por prefixo do `NavLink` em `navigation.ts`. Nível 3 (`/duck-debug`) não roda nesta fase: o roadmap §7 o reserva às Fases 3, 4, 6 e 11, e este diff é dominado por deleções.
- [2026-09-16] Verificação visual: stack isolada local (Postgres/Redis do e2e, API :3334 com `WHATSAPP_ENABLED=false`, web :3001) + captura Playwright local de 10 das 11 telas em claro/escuro × desktop/mobile (`/verify-email` exige o token escopado do cadastro e ficou de fora; ela não foi tocada nesta fase). Nenhuma diferença visível; a nav mobile mantém "Dispositivos" ativo em `/devices/:id`.
