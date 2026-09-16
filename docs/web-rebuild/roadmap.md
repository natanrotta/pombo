# Roadmap — Reconstrução do `apps/web` (tema, design e arquitetura)

| | |
|---|---|
| **Status** | draft — aguardando o intake do design (Fase 0) |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` |
| **Data** | 2026-09-16 |
| **Handoff** | [Pombo Design Foundation](https://claude.ai/design/p/f0e6e630-b1b7-447e-beaf-294e973f8037?file=Pombo+Design+Foundation.dc.html) — arquivos `Pombo Design Foundation.dc.html` + `support.js` |
| **Base analisada** | `origin/develop` @ `fc274d8` (último commit em `apps/web`: `76254d1`, migração Chakra v3 + React 19, 2026-09-15) |

Este documento é o plano completo, sem código, para reconstruir o frontend do Pombo. Ele foi produzido a partir de um inventário exaustivo do `apps/web` e do contrato HTTP do `apps/api` (apêndices A–D). Cada fase vira **um PR** com **uma Task Spec** própria em `.claude/specs/web-rebuild-<fase>.md`, seguindo o fluxo SDD do `CLAUDE.md` (`/start-task` → `/triage` → especialista → babysit → `/finish-task`).

---

## 0. O que está bloqueado e como destravar

O arquivo de design **não pôde ser lido nesta sessão**. Foram tentados, nesta ordem: o MCP de design (`DesignSync` exige `/design-login`, que só roda em sessão interativa), o navegador embutido (cai na tela de sign-in do claude.ai), o Claude in Chrome (extensão desconectada), `WebFetch` (403) e busca por cópia local (nenhuma). Sem ele, a Fase 0 não fecha e as Fases 3+ não podem começar; as Fases 1 e 2 são independentes do design e podem começar já.

Qualquer uma destas três opções destrava:

1. Rodar `/design-login` uma vez num terminal `claude` interativo nesta máquina (a autorização passa a valer para as sessões seguintes).
2. Conectar a extensão Claude in Chrome (o Chrome já tem a sessão do claude.ai).
3. Exportar os dois arquivos e commitá-los em `docs/design/` (mesma convenção já usada em `clintplay/docs/design/` e `clint-mobile/docs/design/`): `docs/design/Pombo Design Foundation.dc.html` e `docs/design/support.js`. **Recomendado** — o handoff fica versionado junto do código que o implementa.

---

## 1. Diagnóstico — por que reconstruir

### 1.1 O que existe hoje

| Métrica | Valor |
|---|---|
| Arquivos `.ts/.tsx` em `apps/web/src` | 196 (167 sem specs) |
| Linhas | 15.592 (13.345 sem specs) |
| Páginas reais | 11 (5 auth + devices list/detail + sandbox + perfil + api + 404) |
| Módulos | 5 (`auth`, `devices`, `messaging`, `account`, `settings`) |
| i18n | 3 locales × 5 namespaces × 558 chaves (sem drift entre locales) |
| Testes unitários | 29 specs, ~159 casos |
| Testes e2e | 1 spec, 2 testes (`auth.spec.ts`) |
| `data-cy` / `data-testid` | 3 + 1 no app inteiro |

**Stack:** React 19.2 · Vite 5 · TypeScript 5 strict · Chakra UI 3.36 (+ `next-themes`, `@emotion/react`, `framer-motion` 12) · react-router-dom 6 (`BrowserRouter`, sem data router) · TanStack Query 5 · axios · react-hook-form + zod · i18next · lucide-react · Bugsnag · `@react-oauth/google` · `qrcode` · `libphonenumber-js`. Deploy estático no Cloudflare Pages (`dist/version.json` gerado no build).

**Arquitetura atual:** Clean Architecture por módulo (`domain/ · infrastructure/ · presentation/`), DI de repositórios em `core/di/repositories.ts`, cadeia obrigatória `página → hook → repositório → httpClient`, query keys centralizadas, snippets Chakra v3 em `src/components/ui/*`, catálogo de wrappers em `shared/components/{ui,forms,layout,skeletons}`.

### 1.2 O que está errado (evidência no Apêndice C)

A migração v2→v3 de 15/09 é limpa (zero `colorScheme`, `spacing`, `isOpen` sobreviventes). A dívida é **estrutural e visual**, não de props:

1. **Identidade visual híbrida.** O theme é emerald, mas `SignInPage`/`RegisterPage` ainda pintam blobs azul/teal da marca anterior (12 `rgba` hardcoded), os toasts fixam 16 hex light-only **de propósito** (o comentário em `toaster.tsx:23-24` os declara como os únicos hex sancionados fora do theme, porque o toast flutua num Portal fora da árvore de color mode — mesmo assim ficam pastéis no dark; a Fase 3 reverte essa decisão conscientemente ao levá-los para `status.*` com `_dark`), e o `ColorModeToggle` usa um indigo fora da paleta via condicional de color mode (`F-H16`).
2. **Código morto em volume.** `RichTextField` + `normalizeTiptapHtml` + ~90 linhas de CSS ProseMirror no theme + 5 deps `@tiptap/*` — zero consumidores. Mais 7 utils (`string`, `fieldValue`, `monetary`, `document`, `transcriptHtml`, `mergeEdits`, `pagination`), 2 hooks (`useBulkSelection`, `useInfiniteScrollSentinel`), tokens (`accent.gold`, `shadows.recording-glow`), `queryKeys.{settings,auth,health}`, `GC_TIMES`, e as deps `jspdf`, `jspdf-autotable`, `dompurify`. Cada util morto ainda carrega um spec — 7 dos 29 specs testam código que não roda.
3. **Resíduo de boilerplate de outro produto.** Error codes `COPILOT_*`, `INSUFFICIENT_TOKENS`, `WORKPLACE_NOT_FOUND`; comentário em `httpClient.ts` sobre um `HttpCopilotRepository` inexistente; `PageTransition` documenta `/templates/:id`; `vite.config.ts` cita `buildPatientDocumentFilename`.
4. **Quatro sistemas de formulário para o mesmo trabalho.** RHF+Zod (SignIn/Register), `useFormState` (Sandbox/CreateDevice), `useState` cru (Forgot/Reset) e `useDetailPageController` (Profile/Webhooks).
5. **Testes na superfície errada.** Zero testes em devices, messaging e account — o produto inteiro. O `global.setup.ts` do e2e asserta `/dashboard`, rota que não existe (o catch-all `*` faz o teste passar sempre). Sem page objects, sem `test-data.ts`.
6. **Contrato duplicado.** `@pombo/shared-types` está declarado como dependência e tem dois special-cases no `vite.config.ts`, mas **nenhum import** em `apps/web`. Só cobre auth/user; Device, Message, ApiToken e os `ErrorCode`s são redeclarados em cada app e vão drifar (`X-C1`).
7. **Duplicações e drift de config.** Nav declarada em `navigation.ts` e redeclarada em `MobileBottomNav`; alias map escrito 3× (tsconfig, vite, vitest — e `@assets` falta no vitest, então 4 componentes não são testáveis); dois `pombo-icon.svg`; `.playwright/report/index.html` (514 KB) commitado.
8. **Observabilidade meio-ligada.** `RouteErrorBoundary` (que captura todo erro de página) só faz `console.error`; só o `GlobalErrorBoundary` reporta ao Bugsnag.
9. **Docs falsas.** `apps/web/README.md` diz React 18 + Chakra 2 e cita `modules/dashboard`; `patterns/frontend.md` documenta um `withAppShell()` que não existe e tokens do theme azul antigo.
10. **`SettingsRepository` vazio** (`interface {}` / `class {}`) registrado no DI.

### 1.3 O que NÃO está errado (e o roadmap preserva)

- O contrato de auth do cliente: cookie httpOnly `pombo_at`, CSRF double-submit `pombo_csrf` → `X-CSRF-Token`, refresh single-flight só para `AUTH_TOKEN_EXPIRED|INVALID|REVOKED|AUTH_NO_TOKEN`, token escopado `email:verify` em `sessionStorage` só para `/auth/email-verification/*`.
- A cadeia `hook → repositório → httpClient` e as query keys centralizadas (BASELINE R12/R13).
- Os snippets v3 em `src/components/ui/*` como único ponto de montagem de compound components.
- i18n em 3 locales com paridade total.
- O e2e stack (`docker-compose.e2e.yml` + `scripts/e2e-run.ts` + `global.setup.ts` semeando cookies via API).

---

## 2. Contrato com o backend (o que a nova web consome)

Inventário completo no Apêndice B. O que muda a forma de desenhar telas:

- **37 rotas de negócio (+ 2 de health)** — auth 13, account 2, devices 9, messaging 7, API pública 6 —, todas em `{ ok: true, data }` / `{ ok: false, error: { code, message, details } }`. A UI chaveia por `code`, nunca por `message` (que já vem traduzida por `Accept-Language`). 422 traz `details = ZodError.flatten()` → é daí que saem os erros por campo.
- **Não existe:** SSE/WebSocket (QR, status de device e status de mensagem são **polling** — 3 s / refetch / 2 s), paginação (`GET /devices` devolve array puro), histórico de mensagens (o outbox é protocolo, não histórico, e expira em 24 h), CRUD de webhooks (é `PATCH /devices/:id/webhooks`, 5 URLs por device), log de entregas de webhook, lista/revogação de API token (é um credencial única, `POST` rotaciona e revoga a anterior), roles/onboarding/billing/contatos.
- **Segredos de exibição única:** `webhookSecret` só na resposta 201 de `POST /devices`; `token` só na 201 de `POST /account/api-token`. A UI precisa do padrão "mostra uma vez + copiar + aviso irrecuperável" (já existe, precisa sobreviver ao redesign).
- **Estados que a UI é obrigada a tratar:** os 5 status de device (`DISCONNECTED | CONNECTING | QR_PENDING | CONNECTED | LOGGED_OUT`); `{ status: "QR_PENDING", qr: null }` como transiente legal (skeleton e espera o próximo poll); `WA_GATEWAY_DISABLED` (409) como empty state de primeira classe — o gateway vem **desligado por padrão** em todo ambiente; `DEVICE_OFFLINE` (503) na lista de grupos; 202 em connect/send significa *aceito*, não *feito*; `PENDING` pode durar minutos por causa do pacer anti-ban; 429 no auth (10 req / 15 min por IP) precisa de UI graciosa com `Retry-After`; lag de até 60 s na revogação do API token (cache Redis).
- **Config que a web não pode quebrar:** `FRONTEND_URL` monta `${FRONTEND_URL}/reset-password?token=…` e `${FRONTEND_URL}/pombo-icon.svg` (e-mails transacionais) — a rota `/reset-password` e o asset público `/pombo-icon.svg` são contrato. CORS só permite os headers `Content-Type, Authorization, Accept-Language, X-CSRF-Token, Idempotency-Key`; qualquer header novo é mudança de API. Body JSON limitado a 10 KB → mídia é sempre URL, nunca base64.

---

## 3. Decisões de arquitetura (alvo)

Cada decisão abaixo foi tomada com base no inventário. As marcadas **[ABERTA]** mudam o roadmap dependendo da resposta; elas e as demais perguntas relevantes (handoff, R11, fontes, snapshots) estão consolidadas na §5 para revisão no PR.

| # | Decisão | Racional | Alternativa rejeitada |
|---|---|---|---|
| **D1** | **Reconstrução in-place e incremental na própria `apps/web`, um PR por fase.** | 11 páginas / 15 k LOC não justificam um segundo app; a paridade de rotas, i18n, auth e e2e se mantém viva a cada PR; o Cloudflare Pages continua servindo o mesmo `dist`. | `apps/web-v2` paralela com cut-over — dobra manutenção durante meses e esconde regressão até o corte. **[ABERTA — confirmar]** |
| **D2** | **Chakra UI v3 permanece como sistema de componentes.** | Migrado há 2 dias, em paridade com o `cuidda`; trocar de lib seria uma segunda migração sem ganho de produto. O redesign entra via tokens + recipes + snippets, exatamente onde a v3 foi desenhada para receber. | Tailwind/shadcn/Panda — reescrita total dos 43 wrappers e perda da paridade com o `cuidda`. |
| **D3** | **A fundação de design vira o pacote `packages/theme` (`@pombo/theme`)**, espelho estrutural do `@cuidda/theme`: `tokens` (colors, fonts, fontSizes, radii, shadows), `semanticTokens`, `textStyles`, `recipes`, exportados como um `defineConfig`. O app compõe `createSystem(defaultConfig, pomboThemeConfig, appConfig)`. | O pacote é o artefato que representa o handoff; separa "o que a marca é" de "como o app usa"; a spec anterior já deixou isso como diferido explícito; permite um segundo consumidor (site/admin) sem copiar theme. | Manter em `apps/web/src/app/theme` — funciona, mas o theme vira dependência implícita do app e drifta no primeiro consumidor novo. |
| **D4** | **Manter a tríade `domain/infrastructure/presentation` por módulo** e a DI em `core/di/repositories.ts`; **não** achatar para feature-slices neste roadmap. | `.claude/**` é compartilhado com o `cuidda` (fonte de verdade do workflow); `patterns/frontend.md`, BASELINE R12/R13, os hooks de lint e o `code-auditor` codificam a tríade. Achatar diverge o Pombo do `cuidda` dois dias depois de convergir, e obriga a reescrever os patterns compartilhados. | Feature-slice (`modules/<m>/{api,hooks,components,pages}`) — mais leve para 5 módulos, mas o custo de divergência do workflow compartilhado supera o ganho. **[ABERTA — o usuário pediu "mudar a arquitetura"; se a intenção é achatar, isso vira a Fase 11 e inclui o port dos patterns]** |
| **D5** | **Três caminhos oficiais de formulário, quatro é demais:** RHF + Zod (`buildXSchema()` lazy) para formulários validados; `useFormState` para modais simples; `useDetailPageController` + `useUnsavedChangesGuard` para páginas de detalhe com autosave. **`useState` cru sai** (Forgot/Reset migram para RHF + Zod). | É o que a BASELINE R16 já diz; hoje o app não cumpre. | Reduzir a 1 caminho (só RHF) — quebra o autosave de detalhe, que é o padrão certo para Profile/Webhooks. |
| **D6** | **`@pombo/shared-types` passa a ser o contrato de verdade** para Device, DeviceStatus, DeviceWebhooks, Message (send DTOs + MessageStatus + MessageType), ApiToken metadata, `MeResponseDTO` e o enum `ErrorCode`; os dois apps importam de lá. | Mata a duplicação que hoje existe (`X-C1`) e dá `tsc` como gate de sincronia BE↔FE. | Continuar duplicando e confiar no `check-contract-sync.sh` (heurístico, advisory). |
| **D7** | **Galeria de design system em rota DEV-only** (`/dev/design-system`, `import.meta.env.DEV`), com **Playwright `toHaveScreenshot`** sobre ela como guarda de regressão visual em light e dark. | O redesign toca todo pixel; sem baseline visual a única defesa é olho humano. A galeria também é a documentação viva dos primitivos. O `cuidda` tem `modules/development` com a mesma função. | Chromatic/Storybook — dependência e infra novas para um app de 11 páginas. |
| **D8** | **Fontes self-hosted via `@fontsource-variable/*`** (ou `@fontsource/*`) se o design trocar as famílias; `index.html` deixa de carregar Google Fonts render-blocking. | Performance (sem round-trip externo no critical path), privacidade, build determinístico. | Manter `<link>` para Google Fonts — é o que existe; aceitável se o design mantiver Inter + JetBrains Mono. **Depende da Fase 0.** |
| **D9** | **Nenhuma capacidade nova de backend entra neste roadmap.** Histórico de mensagens, realtime (SSE), paginação, log de entregas de webhook e revogação explícita de token são gaps reais, mas são roadmap próprio (`/fullstack`). | O escopo pedido é tema + design + arquitetura do web. Misturar backend novo faz cada fase depender de migração e API. | Incluir "inbox" ou "webhook deliveries" porque o design pode sugerir — só se a Fase 0 mostrar telas que exigem isso. **[ABERTA]** |
| **D10** | **Router permanece `react-router-dom` v6 com `BrowserRouter`.** Sem data router/loaders neste roadmap. | Sem ganho para 11 páginas com TanStack Query já fazendo o data layer. | Upgrade para v7 / TanStack Router — churn sem retorno. |
| **D11** | **Ordem de execução = encolher antes de pintar.** Fase 1 (limpeza) e Fase 2 (contrato) antes de qualquer pixel. | A spec da v3 provou que deletar a ilha morta primeiro cortou 1/3 da superfície de migração. | Redesenhar por cima do código morto e limpar depois — cada tela redesenhada carregaria dívida junto. |

---

## 4. Fases

Legenda: **Tamanho** S/M/L (esforço relativo); **Especialista** conforme o roteamento do `CLAUDE.md`; **Depende de**: fases que precisam estar mergeadas em `develop`.

### Fase 0 — Intake do design (bloqueada, ver §0)

| | |
|---|---|
| Tamanho / Risco | S / Baixo (mas bloqueia tudo a partir da Fase 3) |
| Especialista | `/ui-design` (leitura) + `/frontend` (mapa de tokens) |
| Depende de | acesso ao handoff |

**Entregas**
- `docs/design/Pombo Design Foundation.dc.html` + `docs/design/support.js` versionados (o `.dc.html` é um documento `<x-dc>` com artboards inline-styled; `support.js` é o runtime que o renderiza — abre no navegador sem build).
- `docs/design/foundation-map.md`: tabela **design → token/recipe alvo**, cobrindo: paletas (ramps 50–900 em hex/oklch) → `tokens.colors`; superfícies/texto/borda/status light+dark → `semanticTokens` (`bg.*`, `text.*`, `border.*`, `status.*`); famílias, escala e pesos → `fonts`/`fontSizes`/`textStyles`; radii; sombras; espaçamento; motion (durações/easings → `shared/constants/animation.ts`); e um inventário de componentes desenhados (button variants/sizes, inputs/select/textarea, badge/status, cards, nav/sidebar/bottom-nav, modal/drawer, toast, empty state, skeleton, tabs/table se existirem) com o mapeamento para o snippet ou wrapper que o implementa.
- Lista de **conflitos com as regras vigentes**: se o design usar amarelo/laranja/âmbar, isso colide com BASELINE R11 (`F-C3`) e precisa de decisão (mudar a regra e o hook `post-edit-frontend.sh`, ou ajustar o design). Idem para qualquer tom que colida com o esquema warning=roxo / info=azul.
- Decisão D8 (fontes) fechada.

**Critérios de aceite**
- AC-0.1 — Todo primitivo visual presente no `.dc.html` tem uma linha no `foundation-map.md` com destino (`token`, `recipe`, `snippet` ou `wrapper`) ou está explicitamente em "fora de escopo".
- AC-0.2 — O mapa lista os tokens semânticos **existentes** que mudam de valor e os **novos**, com par `base`/`_dark` para cada um.
- AC-0.3 — Conflitos com R10/R11 e com o `code-review-checklist.md` estão listados com a decisão tomada.

### Fase 1 — Limpeza de base (zero mudança visual)

| | |
|---|---|
| Tamanho / Risco | M / Baixo |
| Especialista | `/frontend` |
| Depende de | — (pode começar agora) |

**Escopo**
- Deletar código sem consumidor: `RichTextField.tsx` + `RichTextField.spec.tsx` + `normalizeTiptapHtml.ts` + o bloco `.rich-text-editor/.rich-text-viewer` do `globalCss`; `useBulkSelection` e `useInfiniteScrollSentinel` (+ specs); `shared/utils/{string,fieldValue,monetary,document,transcriptHtml,mergeEdits,pagination}.ts` (+ specs); `shared/types/pagination.ts`; `shadows.recording-glow`; `semanticTokens.accent.gold`; `queryKeys.{settings,auth,health}`; `GC_TIMES` e as tiers de `STALE_TIMES` sem uso (ou passar a usá-las — decisão do especialista, registrada na spec).
- Remover deps: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/extension-placeholder`, `@tiptap/extension-underline`, `jspdf`, `jspdf-autotable`, `dompurify`.
- Remover resíduo de boilerplate: error codes `COPILOT_*`, `INSUFFICIENT_TOKENS`, `WORKPLACE_NOT_FOUND`, `INVITE_ALREADY_MEMBER` em `core/errors/errorCodes.ts`; comentários sobre `HttpCopilotRepository`, `/templates/:id`, `buildPatientDocumentFilename`; o `STABLE_KEY_PATTERNS` vazio do `PageTransition` (simplificar o componente).
- Remover o módulo `settings` vazio do DI (`SettingsRepository {}` / `HttpSettingsRepository {}`) — o `ProfileTab` já usa `useAuth().updateProfile`; a página `/perfil` fica, o repositório fantasma sai.
- Unificar a nav: `MobileBottomNav` passa a consumir `navigationSections`.
- Unificar os aliases: um único mapa (`apps/web/aliases.ts` ou equivalente) importado por `vite.config.ts` e `vitest.config.ts`; `tsconfig.paths` continua espelhado; `@assets` passa a existir no vitest.
- `.playwright/` entra no `.gitignore`; `apps/web/.playwright/report/index.html` sai do git.
- `global.setup.ts`: a sanity check passa a abrir `/devices` e assertar o shell (não `/dashboard`).
- Corrigir o `RouteErrorBoundary` para reportar ao `errorReporter` (não só `console.error` em DEV).
- Sign-out limpa todas as chaves `@pombo-web:*` exceto o idioma (`patterns/frontend.md` § Auth exige; hoje `sandbox-recent-recipients` sobrevive); `sidebar-collapsed` ganha o prefixo.
- `apps/web/README.md` reescrito para o estado real.

**Critérios de aceite**
- AC-1.1 — `yarn type-check && yarn lint && yarn test && yarn build` verdes; `yarn test:e2e` verde.
- AC-1.2 — `grep -rn "tiptap\|jspdf\|dompurify\|COPILOT_\|HttpCopilotRepository\|/templates/" apps/web` vazio; nenhuma das deps listadas em `apps/web/package.json`.
- AC-1.3 — Uma reexecução da análise de alcançabilidade a partir de `main.tsx` + specs não acusa arquivo morto.
- AC-1.4 — Nenhuma mudança visível: as 11 páginas renderizam igual (verificação manual light/dark + o e2e existente).
- AC-1.5 — `RouteErrorBoundary` tem spec cobrindo a chamada ao `errorReporter.notify`.

### Fase 2 — Contrato compartilhado (`@pombo/shared-types`)

| | |
|---|---|
| Tamanho / Risco | M / Médio (toca `apps/api` e `apps/web`) |
| Especialista | `/fullstack` |
| Depende de | — (paralela à Fase 1; conflitos de merge são pequenos) |

**Escopo**
- Mover para `packages/shared-types/src/`: `DeviceStatus`, `DeviceWebhooks`, `DeviceResponseDTO` (o `toJSON()` do device), `RegisterDeviceResponseDTO` (`{ id, webhookSecret }`), `DeviceQrResponseDTO`, `DeviceGroupDTO`; `MessageType`, `MessageStatus`, `SendMessageResponseDTO`, `MessageStatusResponseDTO`, os DTOs de envio (text/group/image/audio/video/document); `ApiTokenMetadataDTO`, `GenerateApiTokenResponseDTO`; o enum `ErrorCode` (hoje em `apps/api/src/shared/error/error-codes.ts` e redeclarado em `apps/web/src/core/errors/errorCodes.ts`); e os tipos de envelope (`ApiSuccess<T>`, `ApiError`, `ValidationErrorDetails`).
- `apps/api` passa a importar os tipos do pacote nos DTOs/entidades (`toJSON(): DeviceResponseDTO`), com um spec de contrato garantindo que o enum Prisma `device_status` e `DeviceStatus` do pacote são o mesmo conjunto.
- `apps/web` remove as entidades duplicadas (`modules/*/domain/entities/*.ts` passam a reexportar/estender os tipos do pacote onde precisarem de campos derivados).
- `vite.config.ts` mantém os dois special-cases de CJS (já existem e agora passam a ter consumidor).

**Critérios de aceite**
- AC-2.1 — `grep -rn "@pombo/shared-types" apps/web/src` retorna importações reais em `devices`, `messaging`, `account`, `core/errors`.
- AC-2.2 — Nenhum tipo de resposta HTTP de device/message/api-token é declarado duas vezes no monorepo.
- AC-2.3 — Spec no `apps/api` falha se um `ErrorCode` for adicionado sem entrar nas 3 locales de `errors.json` **e** no pacote.
- AC-2.4 — Zero mudança de comportamento; `yarn test` verde nos dois apps.

### Fase 3 — `@pombo/theme` com a fundação do design

| | |
|---|---|
| Tamanho / Risco | L / Alto (toca todo pixel) |
| Especialista | `/frontend` (+ `/ui-design` na revisão visual) |
| Depende de | Fase 0, Fase 1 |

**Escopo**
- Criar `packages/theme` (`@pombo/theme`) com a forma do `@cuidda/theme`: `src/index.ts` exportando `pomboThemeConfig = defineConfig({ theme: { tokens, semanticTokens, textStyles, recipes } })` + `src/foundations/{colors,typography,radii,shadows,semantic-tokens,text-styles,recipes}.ts`. `peerDependency` em `@chakra-ui/react ^3.36`. Sem `globalCss`, sem color mode — isso é do app.
- Popular as foundations a partir do `foundation-map.md` (Fase 0): novas ramps, novos semânticos light/dark, tipografia, radii, sombras, recipes (`button`, `badge`, `input`, `textarea` + os que o design exigir).
- `apps/web/src/app/theme/index.ts` vira composição: `createSystem(defaultConfig, pomboThemeConfig, appConfig)` onde `appConfig` só tem `globalCss` (body, scrollbar, seleção) e overrides de app. As foundations locais são deletadas.
- Fontes conforme D8 (`@fontsource-*` + `index.html` sem Google Fonts, ou manter os `<link>`).
- Eliminar **todo** hex/rgba fora do theme: `toaster.tsx` (16 hex → `status.*.bg/fg/border`, ganhando dark mode), `SignInPage`/`RegisterPage` (12 rgba → tokens `bg.brand.*`/gradientes por token), `ColorModeToggle` (condicional de color mode → tokens com `_dark`), `recipes.danger` (`#ffffff` → `text.onBrand`/`white`).
- Spec de contrato de tokens no pacote (a exemplo de `zIndexTokenContract.spec.ts` do `cuidda`): todo semântico tem `base` **e** `_dark`; nenhum valor de `colors` contém amarelo/laranja/âmbar (exceto o que a Fase 0 tiver liberado explicitamente).
- `post-edit-frontend.sh` e `code-review-checklist.md` atualizados se a Fase 0 mudou alguma regra de cor.

**Critérios de aceite**
- AC-3.1 — `packages/theme` existe, `yarn workspace @pombo/theme type-check` verde, e `apps/web/src/app/theme/foundations/` não existe mais.
- AC-3.2 — `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" apps/web/src --include=*.tsx --include=*.ts` retorna apenas o que a spec da fase listar como exceção documentada (meta: zero fora de `packages/theme`).
- AC-3.3 — Nenhum `useColorMode().colorMode === …` fora de `GoogleSignInButton` (exceção documentada: o SDK do Google exige tema por prop).
- AC-3.4 — Toasts corretos em dark mode (verificação manual + screenshot na galeria da Fase 4).
- AC-3.5 — As 11 páginas renderizam com o novo theme sem mudança de layout; e2e verde; light/dark conferidos manualmente.
- AC-3.6 — O spec de contrato de tokens passa e falha se um semântico perder o `_dark`.

### Fase 4 — Camada de design system (primitivos) + galeria DEV

| | |
|---|---|
| Tamanho / Risco | L / Médio |
| Especialista | `/frontend` |
| Depende de | Fase 3 |

**Escopo**
- Reconciliar `src/components/ui/*` (snippets) e `shared/components/{ui,forms,layout,skeletons}` com os componentes do design: `Button` (variants/sizes via recipe), `StatusBadge`/`Badge`, `SectionCard`/`EntityCard`/`StatCard`, `Field`+`FormField`/`SelectField`/`TextAreaField`/`NumberField`/`PasswordField`, `AppModal`/`ConfirmDialog`, `Drawer`, `ActionMenu`, `Tooltip`, `Toaster`, `EmptyState`, skeletons, `PageHeader`, `FilterBar`, `CopyButton`, `SaveButton`, `InfoRow`; mais os que o design introduzir (tabs, tabela, stepper, etc.).
- Regra de reuso mantida: estender antes de criar; **props públicas preservadas** onde possível para que as Fases 6–9 troquem só o miolo (mesma tática da migração v3).
- `data-cy` em todo primitivo interativo (botões, campos, itens de menu, triggers de modal) — hoje há 3 no app inteiro; sem isso o e2e das fases seguintes vira caça a seletor.
- Rota DEV-only `/dev/design-system` (`ROUTE_PATHS.devDesignSystem`, só registrada quando `import.meta.env.DEV`) renderizando todos os primitivos em todos os estados (default/hover/focus/disabled/loading/error, light/dark).
- Playwright: `e2e/tests/design-system/gallery.spec.ts` com `toHaveScreenshot` por seção em light e dark; snapshots commitados em `e2e/__screenshots__/`. É o guarda de regressão das fases seguintes (D7).
- `code-auditor`/`code-reviewer` recebem, na spec, a lista de wrappers cujas props mudaram (para o `check-contract-sync` e a revisão).

**Critérios de aceite**
- AC-4.1 — Todo componente do inventário da Fase 0 tem implementação e aparece na galeria.
- AC-4.2 — `gallery.spec.ts` passa em light e dark; os snapshots estão versionados.
- AC-4.3 — `grep -c "data-cy" apps/web/src` ≥ número de primitivos interativos listados na spec.
- AC-4.4 — Os 3 specs de wrapper existentes (`AppModal`, `useNotify`, `color-mode`) continuam verdes; novos specs para todo wrapper que ganhou lógica (não para puramente visuais — R27).
- AC-4.5 — A rota `/dev/design-system` não existe no bundle de produção (`yarn build` + grep no `dist`).

### Fase 5 — App shell e navegação

| | |
|---|---|
| Tamanho / Risco | M / Médio |
| Especialista | `/frontend` |
| Depende de | Fase 4 |

**Escopo**
- `AppShell`, `SidebarNav` (328 linhas hoje — dividir: logo/brand, nav, user menu), `MobileHeader`, `MobileBottomNav`, `AppVersion`, `PageTransition`, `RouteFallback` (skeleton em vez de `Box minH=40vh`), `NotFoundPage` conforme o design.
- `navigation.ts` continua fonte única; ícones do design (manter `lucide-react`; o barrel `icons/index.ts` de 284 linhas com nomes legados `Fi*` é candidato a virar exports diretos do lucide com nomes reais — decisão do especialista na spec).
- `ProtectedRoute` troca o `<Spinner>` de tela cheia por skeleton de shell (R17).
- Color mode e idioma nos lugares que o design definir (hoje: user menu + `PageHeader` do perfil).

**Critérios de aceite**
- AC-5.1 — Shell responsivo em `base`/`md`/`lg` conforme o design; sidebar colapsável mantém `@pombo-web:sidebar-collapsed`.
- AC-5.2 — `e2e/tests/shell/navigation.spec.ts`: navega pelos 4 itens, abre o user menu, alterna color mode (persistência em `pombo-color-mode`), troca idioma, faz sign-out (limpa storage e vai para `/sign-in`).
- AC-5.3 — Snapshot da galeria + snapshot do shell (light/dark) verdes.

### Fase 6 — Autenticação (5 telas)

| | |
|---|---|
| Tamanho / Risco | M / Alto (superfície de auth — babysit nível 3 `/duck-debug` obrigatório) |
| Especialista | `/frontend` |
| Depende de | Fase 4 (Fase 5 não é necessária — as telas ficam fora do shell) |

**Escopo**
- `SignInPage` (378 linhas), `RegisterPage` (374), `EmailVerificationPage`, `ForgotPasswordPage`, `ResetPasswordPage` reconstruídas sobre o DS; as duas grandes divididas em subcomponentes (layout de auth compartilhado + formulário).
- D5: Forgot/Reset migram para RHF + Zod com `buildXSchema()` lazy.
- Contratos preservados byte a byte: `/reset-password?token=` (link do e-mail), `/verify-email` com token escopado em `sessionStorage`, `PublicOnlyRoute`/`getPostAuthDestination`, `GoogleSignInButton` (`data-cy="google-signin"`), 429 com `Retry-After` exibido, cooldown de 60 s no reenvio do PIN (server-side — a UI espelha), `AUTH_EMAIL_ALREADY_VERIFIED` tratado.
- `RouteErrorBoundary` cobrindo as rotas públicas (hoje só o `GlobalErrorBoundary` as cobre).

**Critérios de aceite**
- AC-6.1 — `auth.spec.ts` existente passa sem mudança de seletor (ou mudança justificada).
- AC-6.2 — Novos e2e: `auth/register-verify.spec.ts` (cadastro → PIN — lendo o PIN do banco via fixture da API e2e), `auth/forgot-reset.spec.ts` (fluxo + negativo com token inválido), `auth/sign-in-negative.spec.ts` (credencial errada, 429 simulado via `route()`).
- AC-6.3 — Zero `rgba`/hex nas 5 telas (AC-3.2 mantido).
- AC-6.4 — `/duck-debug` retorna CLEAN.

### Fase 7 — Dispositivos (módulo canônico)

| | |
|---|---|
| Tamanho / Risco | L / Médio |
| Especialista | `/frontend` |
| Depende de | Fases 2, 5 |

**Escopo**
- `DevicesListPage` (stats, filtro client-side, cards, criar, excluir, desconectar), `DeviceDetailPage` (info, conectar/QR/desconectar/excluir, webhooks com autosave), `CreateDeviceModal` (segredo de exibição única), `QrConnectModal` (poll 3 s, transiente `qr: null` → skeleton), `DeviceWebhooksSection` (5 URLs, `useDetailPageController` + `useUnsavedChangesGuard`), `DeviceCard`, `DeviceStatusBadge` (5 status).
- Empty states de primeira classe: sem devices; `WA_GATEWAY_DISABLED`; `DEVICE_OFFLINE` nos grupos.
- Tipos vindos do `@pombo/shared-types` (Fase 2).
- **Testes unitários dos hooks** (`useDevices.ts` — hoje zero): invalidação seletiva (`F-C6`), `useDeviceQr` com `gcTime: 0` e `enabled`, `useUpdateDeviceWebhooks` com `setQueryData(detail)`.

**Critérios de aceite**
- AC-7.1 — e2e `devices/device-crud.spec.ts` (criar → ver segredo → detalhe → editar webhook → excluir), `devices/device-connect.spec.ts` (com `WHATSAPP_ENABLED=false` no stack e2e: connect → empty state `WA_GATEWAY_DISABLED`), com page objects em `e2e/pages/devices/*.page.ts` e `fixtures/test-data.ts`.
- AC-7.2 — Specs unitários para todos os hooks de `useDevices.ts`.
- AC-7.3 — Snapshots light/dark das duas páginas na suíte visual.
- AC-7.4 — Todo item de lista `memo()` (R19); nenhum `useQuery` inline em página (R18).

### Fase 8 — Sandbox de mensagens

| | |
|---|---|
| Tamanho / Risco | M / Médio |
| Especialista | `/frontend` |
| Depende de | Fase 7 |

**Escopo**
- `SandboxPage` (453 linhas) dividida: seletor de device (só `CONNECTED`), seletor de tipo (`text | group | image | audio | video | document`), `RecipientNumberField` + recentes, campos por tipo (mídia sempre por URL — body de 10 KB), rajada (máx. 20 = `SEND_RATE_MAX`), `SandboxQueue`/`SandboxQueueItem` (poll 2 s até `READ`/`FAILED`), `Idempotency-Key` por item.
- Estados: sem device conectado (empty state com CTA para `/devices`), `NUMBER_NOT_ON_WHATSAPP`, `IDEMPOTENCY_KEY_CONFLICT`, `DEVICE_OFFLINE` nos grupos, `PENDING` longo (pacer) com explicação.

**Critérios de aceite**
- AC-8.1 — Specs unitários de `useSendMessage`/`useRecentRecipients` (hoje zero).
- AC-8.2 — e2e `messaging/sandbox-send.spec.ts` com o envio interceptado por `route()` (o gateway está desligado no e2e) validando o header `Idempotency-Key`, o corpo por tipo e o poll de status; negativo com `NUMBER_NOT_ON_WHATSAPP`.
- AC-8.3 — Nenhum arquivo de página acima de ~200 linhas (guardrail da spec).

### Fase 9 — Perfil e API (account + settings)

| | |
|---|---|
| Tamanho / Risco | S / Baixo |
| Especialista | `/frontend` |
| Depende de | Fase 5 |

**Escopo**
- `ProfileTab` (avatar upload 5 MB / MIME allowlist, nome/e-mail com autosave, idioma, color mode, "enviar e-mail de redefinição"), `ApiTokenTab` (metadados prefix/createdAt/lastUsedAt, gerar/rotacionar com `ConfirmDialog` — deixar explícito que rotacionar **revoga a anterior** e que a revogação leva até 60 s —, revelação única, download da collection Postman).
- `/settings` continua redirecionando para `/perfil`.

**Critérios de aceite**
- AC-9.1 — `ProfileTab.spec.tsx` (6 casos) mantido; spec de `useApiToken` novo.
- AC-9.2 — e2e `account/api-token.spec.ts` (gerar → copiar → rotacionar → confirmar que o prefixo mudou) e `settings/profile.spec.ts` (autosave + guard de unsaved changes).
- AC-9.3 — Snapshots light/dark.

### Fase 10 — Gate final: qualidade, CI e documentação

| | |
|---|---|
| Tamanho / Risco | M / Baixo |
| Especialista | `/frontend` + `/devops` (CI) |
| Depende de | Fases 6–9 |

**Escopo**
- CI (`.github/workflows/ci.yml`): adicionar `yarn build:web` e um job Playwright (serviços `postgres:15` + `redis:7`, `WHATSAPP_ENABLED=false`, upload do report como artifact). Hoje não existe build nem e2e de web no CI.
- Auditoria final: `/normalize apps/web` (auditor) + `/security` (o token escopado em `sessionStorage`, CSP/CORS do lado do cliente) + `/ui-design` (consistência) — relatórios anexados ao PR.
- Performance: conferir `manualChunks` após as trocas de deps; orçamento de bundle inicial registrado na spec (medido com `vite build --report` ou `rollup-plugin-visualizer` em dev only).
- A11y: todo ícone-botão com `aria-label`, foco visível nos tokens, contraste AA nos pares `text.*` × `bg.*` (verificado na galeria).
- Docs: `.claude/patterns/frontend.md` (remover `withAppShell`, tokens do theme azul, adicionar `@pombo/theme`, galeria, `data-cy`), `BASELINE.md` (R10 aponta para o pacote), `code-review-checklist.md`, `e2e.md` (novos POMs/fixtures), `apps/web/README.md`, `packages/theme/README.md`. Port das mudanças de patterns para o `cuidda` (memória: `.claude/**` é compartilhado — sincronizar por diff normalizado).
- `.claude/learning/violations.md` com o ledger das fases; radar de promoção rodado.
- **Testes das Fases 5–9, concentrados aqui** (decisão de 2026-09-16, ver §7): specs unitários e e2e, page objects, fixtures e snapshots visuais que cada fase lista nos seus ACs são escritos e executados nesta fase, junto com a suíte completa (`yarn test`, `yarn test:e2e`, galeria).

**Critérios de aceite**
- AC-10.1 — CI verde com build de web + e2e.
- AC-10.5 — Os ACs de teste das Fases 5–9 (AC-5.2, AC-5.3, AC-6.1, AC-6.2, AC-7.1–7.3, AC-8.1, AC-8.2, AC-9.1–9.3) estão cumpridos e verdes.
- AC-10.2 — `/normalize` sem Critical/High.
- AC-10.3 — `patterns/frontend.md` descreve o código que existe (conferido contra `ls` real).
- AC-10.4 — Nenhuma referência ao theme antigo, ao `withAppShell` ou a `modules/dashboard` em nenhum doc.

### Fase 11 (condicional, D4) — Achatar a arquitetura de módulo

Só entra se a resposta à D4 for "achatar". Escopo: `modules/<m>/{pages,components,hooks,repository.ts,types.ts,index.ts}`, remoção da tríade e do `core/di/repositories.ts` em favor de um repositório por módulo importado pelo hook; atualização de `patterns/frontend.md`, BASELINE R12/R13, `.eslintrc.cjs` (`no-restricted-imports`), `post-edit-frontend.sh` e `code-auditor`; port para o `cuidda` ou aceitação explícita da divergência. Tamanho L / Risco Médio. Depende de tudo acima.

---

## 5. Decisões em aberto para o revisor do PR

| # | Pergunta | Default se não houver resposta |
|---|---|---|
| Q1 | Como entregar o handoff (§0: `/design-login`, Chrome, ou commit em `docs/design/`)? | Aguardar — bloqueia Fase 0 |
| Q2 | D1 — reconstrução in-place incremental (1 PR por fase) ou app paralela com cut-over? | In-place |
| Q3 | D4 — manter a tríade `domain/infrastructure/presentation` (paridade `cuidda`) ou achatar (Fase 11)? | Manter |
| Q4 | D9 — o design mostra telas que exigem backend novo (inbox, log de webhooks, realtime)? Se sim, entram aqui ou em roadmap próprio? | Roadmap próprio |
| Q5 | R11 — se o design usar amarelo/laranja, muda a regra ou muda o design? | Muda o design (a regra é hard no projeto) |
| Q6 | D8 — fontes self-hosted (`@fontsource`) ou Google Fonts? | Self-hosted |
| Q7 | Snapshots visuais (D7) ficam versionados no repo ou só rodam localmente? | Versionados (é o que dá valor no CI) |

---

## 6. Sequenciamento e paralelismo

```
Fase 0 (design) ─┐
Fase 1 (limpeza) ┴─► Fase 3 (theme) ─► Fase 4 (DS + galeria) ─┬─► Fase 5 (shell) ─┬─► Fase 7 (devices) ─► Fase 8 (sandbox) ─┐
                                                              │                   └─► Fase 9 (perfil/API) ──────────────────┼─► Fase 10
                                                              └─► Fase 6 (auth) ────────────────────────────────────────────┘
Fase 2 (shared-types) ─────────────────────────────────────────────────────────────► Fase 7 (devices)
```

A tabela "Depende de" de cada fase em §4 é a fonte de verdade; o diagrama é só a leitura rápida (Fase 2 alimenta a Fase 7, não a Fase 3).

| Fase | Tamanho | Risco | Especialista | Paralelizável com |
|---|---|---|---|---|
| 0 Design intake | S | Baixo | `/ui-design` + `/frontend` | 1, 2 |
| 1 Limpeza | M | Baixo | `/frontend` | 0, 2 |
| 2 Shared types | M | Médio | `/fullstack` | 0, 1 |
| 3 Theme | L | Alto | `/frontend` | — |
| 4 DS + galeria | L | Médio | `/frontend` | — |
| 5 Shell | M | Médio | `/frontend` | 6 |
| 6 Auth | M | Alto | `/frontend` | 5, 7, 9 |
| 7 Devices | L | Médio | `/frontend` | 6, 9 |
| 8 Sandbox | M | Médio | `/frontend` | 9 |
| 9 Perfil/API | S | Baixo | `/frontend` | 6, 7, 8 |
| 10 Gate final | M | Baixo | `/frontend` + `/devops` | — |
| 11 Achatar (cond.) | L | Médio | `/frontend` | — |

Onze PRs (doze com a Fase 11). Fases 1 e 2 começam imediatamente; a Fase 3 é o gargalo e o ponto de maior risco.

---

## 7. Protocolo por fase (definition of done)

1. `/start-task` na worktree própria → `/triage` (ou `/architect` para as Fases 3, 4 e 11) → Task Spec em `.claude/specs/web-rebuild-<fase>.md` com status `approved`.
2. Especialista implementa contra os ACs; babysit nível 1 (`code-auditor`) + nível 2 (`code-reviewer`); nível 3 (`/duck-debug`) obrigatório nas Fases 3, 4, 6 e 11.
3. Gates do `/finish-task`: cobertura (não se aplica ao web, mas a Fase 2 toca `apps/api`), spec compliance, contract sync, `/code-review`, `yarn type-check && yarn lint && yarn test`, `yarn test:e2e` (toda fase toca `apps/web/**`), snapshots da galeria (Fase 4+).
   - **A partir da Fase 5** (decisão de 2026-09-16): cada fase roda só `type-check` e `lint`. Escrever e executar testes (unitários, e2e, snapshots) fica para a Fase 10, que cobre os ACs de teste das Fases 5–9. Até lá, uma fase pode quebrar um snapshot ou um e2e existente; a Fase 10 revisa e atualiza.
4. Checagem manual light/dark das telas tocadas; zero hex/rgba fora do theme (`post-edit-frontend.sh` F-C2); zero amarelo/laranja (F-C3); i18n nas 3 locales; `data-cy` em todo interativo novo.
5. PR para `develop` com a spec linkada e os ACs marcados; `/cleanup-task` após o merge.
6. Rollback: cada fase é um PR reversível; o Cloudflare Pages faz deploy de `main` — a fase só chega em produção no merge `develop → main` (ver `DEPLOY.md`).

---

## 8. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Handoff indisponível prolonga o bloqueio da Fase 0 | Alta (hoje) | Alto | Fases 1 e 2 começam sem ele; §0 lista três formas de destravar |
| O design contradiz regras hard (R11 sem amarelo, warning=roxo, info=azul) | Média | Médio | AC-0.3 força a decisão antes de qualquer pixel; Q5 |
| Regressão visual invisível ao `tsc` (a spec da v3 pegou `bgGradient` e `Separator` só em runtime) | Alta | Médio | Galeria + `toHaveScreenshot` light/dark (Fase 4) como guarda das Fases 5–9 |
| Divergência de `.claude/**` em relação ao `cuidda` | Média | Médio | D4 mantém a tríade; toda mudança de patterns vai na Fase 10 com port explícito |
| Fase 3 grande demais para revisar | Alta | Médio | Ordem interna commitável: pacote → foundations → composição no app → eliminação de hex → spec de contrato; PR descreve a ordem |
| Quebra do contrato de auth (cookies/CSRF/refresh) durante a Fase 6 | Baixa | Alto | `httpClient.ts` e `AuthContext` fora do escopo da Fase 6 (só as páginas mudam); `/duck-debug` obrigatório; e2e de auth negativo |
| `@pombo/shared-types` como CJS continua exigindo special-cases no Vite | Certa | Baixo | Já existem e funcionam; alternativa (ESM `"type": "module"` como o `@cuidda/theme`) avaliada na spec da Fase 2 |
| Snapshots Playwright flaky entre máquinas (fontes/antialias) | Média | Baixo | Rodar snapshots só no container do e2e / CI (mesma imagem); `maxDiffPixelRatio` documentado |
| Aumento de bundle por fontes self-hosted | Baixa | Baixo | Só os pesos usados; `font-display: swap`; orçamento na Fase 10 |

---

## Apêndice A — Rotas atuais (todas preservadas no alvo)

| Path | Página | Guard | Módulo |
|---|---|---|---|
| `/sign-in` | `SignInPage` | `PublicOnlyRoute` | auth |
| `/register` | `RegisterPage` | `PublicOnlyRoute` | auth |
| `/verify-email` | `EmailVerificationPage` | nenhum (token escopado) | auth |
| `/forgot-password` | `ForgotPasswordPage` | `PublicOnlyRoute` | auth |
| `/reset-password` | `ResetPasswordPage` | nenhum (token na query) — **contrato do e-mail** | auth |
| `/` | → `/devices` | `ProtectedLayout` | — |
| `/devices` | `DevicesListPage` | `ProtectedLayout` | devices |
| `/devices/:id` | `DeviceDetailPage` | `ProtectedLayout` | devices |
| `/sandbox` | `SandboxPage` | `ProtectedLayout` | messaging |
| `/perfil` | `ProfilePage` | `ProtectedLayout` | settings |
| `/api` | `ApiPage` | `ProtectedLayout` | account |
| `/settings` | → `/perfil` (legado) | `ProtectedLayout` | — |
| `/404`, `*` | `NotFoundPage` | `ProtectedLayout` (rota desconhecida exige auth) | — |
| `/dev/design-system` | galeria (novo, DEV-only, Fase 4) | — | — |

## Apêndice B — Contrato HTTP (37 rotas de negócio + 2 de health)

**Auth** (`/api/auth`, sem rate limit de usuário, `authRateLimit` 10/15 min por IP): `POST sign-up` (201, `{requiresEmailVerification, token, email, csrfToken}`), `POST sign-in` (200, `{user, token, csrfToken}`), `POST google` (200/201, `{kind, user, …}`), `POST password/request-reset` (204 sempre), `POST password/reset` (204), `POST refresh` (200, cookie `pombo_rt` em path `/api/auth`), `POST email-verification/send` (204, cooldown 60 s → 429), `POST email-verification/verify` (200, sessão completa), `POST sign-out` (204, incrementa `tokenVersion` — invalida todo access token), `GET me`, `PUT profile`, `PUT profile/avatar` (multipart `file`, 5 MB, MIME allowlist), `DELETE account` (204).

**Account** (`/api/account`): `GET api-token` (`{prefix, createdAt, lastUsedAt} | null`), `POST api-token` (201 `{token}` — rotaciona e revoga a anterior).

**Devices** (`/api/devices`): `POST` (201 `{id, webhookSecret}`; 409 `DEVICE_NAME_TAKEN`), `GET` (array), `GET :id`, `GET :id/qr` (`{status, qr}`), `GET :id/groups` (503 `DEVICE_OFFLINE` se offline), `PATCH :id/webhooks` (`.strict()`, `null` limpa), `POST :id/connect` (202; 409 `WA_GATEWAY_DISABLED` / `DEVICE_ALREADY_CONNECTED`), `POST :id/disconnect` (200), `DELETE :id` (204).

**Messaging** (`/api`): `POST devices/:id/messages` (`{phone, text}`), `…/messages/group` (`{groupJid, text}`), `…/messages/{image|audio|video|document}` (`{phone, <media>: url|base64, caption?, fileName?}`) — todos 202 `{messageId, status: "PENDING"}`, **`Idempotency-Key` obrigatório** (400 se ausente; 409 `IDEMPOTENCY_KEY_CONFLICT` se payload diferente); `GET messages/:id` (`{messageId, status, failureReason, createdAt, updatedAt}`; status `PENDING → SERVER_ACK → DELIVERY_ACK → READ`, `FAILED` de qualquer estado exceto `READ`).

**Public API** (`/api/v1`, Bearer `pmb_…`, 120/min por token): `GET devices`, `POST devices/:deviceId/send-{text|image|audio|video|document}` (`message` em vez de `text`, E.164 estrito, `Idempotency-Key` opcional).

**Health**: `GET /healthz` (texto), `GET /api/health` (`{ok, version, uptimeSeconds, gateway?}` — fora do envelope).

**Webhooks de saída** (não é endpoint; a UI só configura): `X-Event-Id`, `X-Signature: sha256=<hmac(timestamp.body)>`, `X-Timestamp`; eventos `device.connected`, `device.disconnected` (debounce 30 s), `device.logged_out`, `message.status`, `message.sent`; 4 tentativas; sem log consultável.

## Apêndice C — Lista de deleção (Fase 1)

Arquivos: `shared/components/forms/RichTextField.tsx`, `RichTextField.spec.tsx`, `normalizeTiptapHtml.ts`; `shared/hooks/useBulkSelection.ts` (+spec), `useInfiniteScrollSentinel.ts` (+spec); `shared/utils/{string,fieldValue,monetary,document,transcriptHtml,mergeEdits,pagination}.ts` (+7 specs); `shared/types/pagination.ts`; `modules/settings/domain/repositories/SettingsRepository.ts`, `modules/settings/infrastructure/repositories/HttpSettingsRepository.ts`; `apps/web/.playwright/report/index.html`.
Trechos: CSS ProseMirror em `app/theme/index.ts`; `recording-glow` em `shadows.ts`; `accent.gold` em `semantic-tokens.ts`; `queryKeys.{settings,auth,health}`; `GC_TIMES`; error codes `COPILOT_*`/`INSUFFICIENT_TOKENS`/`WORKPLACE_NOT_FOUND`/`INVITE_ALREADY_MEMBER`; comentários residuais em `httpClient.ts:24`, `PageTransition.tsx`, `vite.config.ts:79`; lista duplicada em `MobileBottomNav.tsx:21-42` (`bottomNavItems`); entrada `settings` em `core/di/repositories.ts`.
Deps: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/extension-placeholder`, `@tiptap/extension-underline`, `jspdf`, `jspdf-autotable`, `dompurify`.

## Apêndice D — Cores hardcoded fora do theme (Fase 3)

| Arquivo | O quê | Destino |
|---|---|---|
| `src/components/ui/toaster.tsx:30-55` | 16 hex light-only (4 status) + `boxShadow rgba` | `status.{success,info,warning,error}.{bg,fg,border}` + `shadow.panel` |
| `modules/auth/presentation/pages/SignInPage.tsx` (6×) e `RegisterPage.tsx` (6×) | `rgba(47,128,237,…)`, `rgba(30,178,138,…)`, `rgba(95,161,255,…)`, `rgba(15,23,42,…)` — marca azul/teal antiga | tokens `bg.brand.subtle`/gradientes por token do novo design |
| `shared/components/ui/ColorModeToggle.tsx:87-88,150-151` | sombras `rgba` incl. indigo, via `colorMode === "dark" ? … : …` | tokens `shadow.*` com `_dark` (remove o condicional, `F-H16`) |
| `app/theme/foundations/recipes.ts:77` | `color: "#ffffff"` no botão `danger` | `text.onBrand` / `white` (vai para o pacote) |

## Apêndice E — Tamanho por pasta (`apps/web/src`)

| Pasta | Arquivos | LOC |
|---|---:|---:|
| `app/` (theme 887, router 430, providers 44) | 17 | 1.377 |
| `components/ui/` (snippets v3) | 15 | 919 |
| `core/` | 10 | 554 |
| `modules/` (auth 2.113, devices 1.257, messaging 1.126, account 525, settings 446) | 54 | 5.467 |
| `shared/` (components 3.936, hooks 1.754, utils 943, i18n 175, lib 139, outros 120) | 96 | 7.067 |
| `test/` | 2 | 169 |
| `e2e/` + `scripts/` | 7 | 697 |

Maiores arquivos: `SandboxPage.tsx` 453 · `SignInPage.tsx` 378 · `RegisterPage.tsx` 374 · `semantic-tokens.ts` 337 · `useDetailPageController.ts` 337 · `SidebarNav.tsx` 328 · `e2e-run.ts` 309 · `icons/index.ts` 284 · `httpClient.ts` 263 · `DevicesListPage.tsx` 245.
