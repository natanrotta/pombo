# Task Spec — refactor-chakra-v3-standardize-90cd98

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/refactor-chakra-v3-standardize-90cd98` |
| **Date** | 2026-09-14 |
| **Size / Risk** | L / High |
| **Specialist** | /frontend |

## 1. Goal

`apps/web` roda hoje em Chakra UI 2.8.2 enquanto o projeto irmão `cuidda` — a fonte de verdade do workflow e do design system — já roda Chakra v3.36 + React 19 + `next-themes`. Essa divergência custa caro: todo componente novo precisa ser escrito duas vezes, nenhum aprendizado de um lado atravessa para o outro, e o `apps/web` ficou com 23% do `src` inalcançável (uma ilha de template nunca renderizada) que ninguém percebe porque o `tsc` a mantém verde. O resultado desta tarefa é um `apps/web` que renderiza exatamente o mesmo comportamento de hoje, em Chakra v3 + React 19, com a mesma arquitetura de snippets do `cuidda`, sem código morto, e com `patterns/frontend.md` voltando a descrever o código que existe de fato.

## 2. Scope

**In:**
- Upgrade `@chakra-ui/react` 2.8.2 → ^3.36.0; remoção de `@chakra-ui/anatomy`, `@chakra-ui/theme-tools`, `@emotion/styled`; adição de `next-themes` ^0.4.6.
- Upgrade React 18.2 → ^19.2.0 (+ `react-dom`, `@types/react`, `@types/react-dom`), `framer-motion` 10.16.4 → ^12.42.2, `@testing-library/react` ^14.3.1 → ^16.3.0 (+ `@testing-library/dom` ^10.4.0). Versões espelhadas de `cuidda/apps/web/package.json`.
- Theme v2 → v3: `extendTheme` → `createSystem(defaultConfig, defineConfig({...}))`, foundations reescritas no formato de token da v3, overrides de componente → `recipes` / `slotRecipes`.
- Camada de snippets oficiais em `apps/web/src/components/ui/*`, espelhando `cuidda` (15 arquivos — só os que o código vivo consome).
- Reescrita v3 dos **38 arquivos vivos** que usam símbolos removidos na v3 (mapa completo em §4).
- Varredura de props renomeadas na v3 (`isDisabled`→`disabled`, `isLoading`→`loading`, `isInvalid`→`invalid`, `isOpen`→`open`, `spacing`→`gap`, `noOfLines`→`lineClamp`, `colorScheme`→`colorPalette`, `<Icon as={X}/>`→`<Icon><X/></Icon>`) em todo o `src` vivo.
- Remoção dos **55 arquivos inalcançáveis** a partir de `main.tsx` + specs (lista completa em §6), mais `datepicker.css` órfão e as deps que ficam sem consumidor (`react-datepicker`, `@types/react-datepicker`, `date-fns`).
- Padronização: forma única de Context (provider / contextValue / hook), barrels de módulo consistentes, remoção do barrel morto `shared/components/index.ts`.
- Sincronização de `.claude/patterns/frontend.md` (+ os IDs de BASELINE que citam Chakra v2) com o código resultante.

**Out (deferred):**
- Quebrar páginas grandes (`SandboxPage` 428 linhas, `SignInPage` 361, `RegisterPage` 349) em subcomponentes — decisão explícita do usuário (Decision #3).
- Remover as deps já mortas **antes** desta tarefa e sem relação com Chakra/React: `jspdf`, `jspdf-autotable`, `dompurify`. Registradas aqui, tratadas em PR próprio.
- Migrar o `apps/api`. Nada fora de `apps/web/**`, `.claude/patterns/**` e `.claude/specs/**` é tocado.
- Adotar o pacote compartilhado de theme (`@cuidda/theme` ↔ um `@pombo/theme`). O theme continua dentro de `apps/web/src/app/theme`.
- Novos componentes de UI. Nenhuma feature nova, nenhuma mudança de comportamento visível.

## 3. Acceptance criteria

- **AC-1** — `yarn workspace @pombo/web type-check`, `lint` e `test` passam, e `yarn build` gera o bundle, com `@chakra-ui/react` ^3.36.0 e React ^19.2.0 instalados.
- **AC-2** — `grep -r "@chakra-ui/anatomy\|@chakra-ui/theme-tools\|extendTheme\|defineStyleConfig\|createMultiStyleConfigHelpers\|ColorModeScript\|createLocalStorageManager" apps/web/src` não retorna nada.
- **AC-3** — Nenhum arquivo em `apps/web/src` importa `Modal*`, `AlertDialog*`, `Menu(Button|List|Item|Divider)`, `Popover(Body|Content|Trigger|Anchor)`, `FormControl`, `FormLabel`, `FormErrorMessage`, `FormHelperText`, `Tbody`/`Thead`/`Td`/`Th`/`Tr`, `Tab`/`TabList`/`TabPanels`, `NumberInputField`/`NumberInputStepper`, `InputLeftElement`/`InputRightElement`, `Divider`, `PinInputField`, `useToast` ou `useColorMode` de `@chakra-ui/react`.
- **AC-4** — Existe `apps/web/src/components/ui/{provider,color-mode,toaster,dialog,drawer,menu,popover,field,native-select,number-input,pin-input,tooltip,avatar,close-button}.tsx` (14 — `stat` foi dropado, ver Decisions log); `AppProviders` monta `<Provider defaultTheme="system" storageKey={COLOR_MODE_STORAGE_KEY}>` + `<Toaster />`.
- **AC-5** — O color mode continua: respeita o SO na primeira visita e persiste a escolha explícita sob a chave **`pombo-color-mode`** (chave inalterada — usuário que já escolheu um modo não perde a escolha). `ColorModeToggle` alterna e reflete o estado.
- **AC-6** — `useNotify()` mantém a API pública atual (`showSuccess`, `showError`, `showInfo`, `showAutoSaved`) sobre o `toaster` da v3; `LanguageSelector` passa a usar `useNotify` em vez de toast direto.
- **AC-7** — Os wrappers compartilhados mantêm suas props públicas atuais: `AppModal` (`isOpen`/`onClose`/`title`/`primaryActionLabel`/`scrollBehavior`/...), `ConfirmDialog`, `ActionMenu`, `FormField`, `SelectField`, `TextAreaField`, `NumberField`, `PasswordField`, `RichTextField`, `StatCard`, `Tooltip` — nenhum call site fora do próprio wrapper muda de assinatura.
- **AC-8** — Os 55 arquivos listados em §6 (+ `datepicker.css`) não existem mais, e `react-datepicker`, `@types/react-datepicker` e `date-fns` saíram do `package.json`. Uma reexecução da análise de alcançabilidade a partir de `main.tsx` + specs não acusa nenhum arquivo morto novo.
- **AC-9** — Todo Context do app segue uma forma só: `XContext.tsx` (provider) + `xContextValue.ts` (`createContext`) + `useX.ts` (consumidor com guard), com o hook vizinho do provider. Vale para `SidebarContext` e `AuthContext`.
- **AC-10** — Os 5 barrels de módulo (`modules/*/index.ts`) existem, usam o mesmo estilo de path (`@/modules/...`) e não exportam nada deletado. `shared/components/index.ts` foi removido.
- **AC-11** — `.claude/patterns/frontend.md` descreve Chakra v3 (provider, snippets, tokens, recipes), remove do Reuse-First Catalog tudo que foi deletado nesta tarefa, remove as entradas que **já** eram falsas (`ProfileHeader`, `TagBadge`, `StaggerContainer`, `StaggerItem`, `DashboardSkeleton`, `useServerListPage`), e a seção "Adding a New CRUD Module" passa a descrever o caminho real (hooks de módulo sobre TanStack Query, como `useDevices.ts`) em vez do scaffolding genérico deletado.
- **AC-12** — O e2e `e2e/tests/auth.spec.ts` passa sem alteração de seletor (os seletores são `getByRole`/`getByLabel`; se algum precisar mudar, a mudança é justificada no PR).
- **AC-13** — Light e dark continuam corretos nas telas vivas, sem token hardcoded novo (R10) e sem amarelo/laranja (R11).

## 4. Contracts & interfaces

### Mapa v2 → v3 (arquivos vivos — 38)

| Símbolo v2 | Destino v3 | Arquivos vivos afetados |
|---|---|---|
| `ChakraProvider` + `ColorModeScript` + `createLocalStorageManager` | `components/ui/provider` (`ChakraProvider value={system}` + `ColorModeProvider` do `next-themes`) | `app/providers/AppProviders.tsx`, `test/render.tsx` |
| `extendTheme` | `createSystem(defaultConfig, defineConfig(...))` | `app/theme/index.ts` |
| `defineStyleConfig` | `defineRecipe` | `theme/components/{badge,button,textarea}.ts` |
| `createMultiStyleConfigHelpers` + `*Anatomy` | `defineSlotRecipe` (ou estilo movido para o snippet) | `theme/components/{input,menu,modal,number-input,popover,select,tabs}.ts` |
| `Modal*` / `AlertDialog*` | `Dialog.*` via `components/ui/dialog` | `ui/AppModal.tsx`, `ui/ConfirmDialog.tsx` |
| `Drawer*` | `Drawer.*` via `components/ui/drawer` | `layout/AppShell.tsx` |
| `Menu*` | `Menu.*` via `components/ui/menu` | `ui/ActionMenu.tsx`, `layout/SidebarNav.tsx` |
| `Popover*` | `Popover.*` via `components/ui/popover` | `messaging/.../RecipientNumberField.tsx` |
| `FormControl`/`FormLabel`/`FormErrorMessage`/`FormHelperText` | `Field.*` via `components/ui/field` | `forms/{FormField,SelectField,TextAreaField,NumberField,PasswordField,RichTextField}.tsx`, `auth/pages/{SignInPage,RegisterPage}.tsx`, `RecipientNumberField.tsx` |
| `Select` | `NativeSelect.*` via `components/ui/native-select` | `forms/SelectField.tsx` |
| `NumberInput*` | `NumberInput.*` via `components/ui/number-input` | `forms/NumberField.tsx` |
| `InputGroup`+`InputLeft/RightElement` | `InputGroup` com `startElement`/`endElement` (built-in v3) | `forms/PasswordField.tsx`, `ui/FilterBar.tsx` |
| `PinInput`+`PinInputField` | `PinInput.*` via `components/ui/pin-input` | `auth/pages/EmailVerificationPage.tsx` |
| `Avatar` | `Avatar.*` via `components/ui/avatar` | `layout/SidebarNav.tsx`, `layout/MobileHeader.tsx`, `settings/.../ProfileTab.tsx` |
| `Tooltip` | `components/ui/tooltip` (`content` prop) | `layout/SidebarNav.tsx`, `ui/{ColorModeToggle,EntityCard,LanguageSelector}.tsx` |
| `Stat*` | `Stat.*` via `components/ui/stat` | `ui/StatCard.tsx` |
| `Divider` | `Separator` | `auth/pages/{SignInPage,RegisterPage}.tsx`, `ui/PageHeader.tsx` |
| `useToast` | `toaster` de `components/ui/toaster` | `hooks/useNotify.tsx`, `ui/LanguageSelector.tsx` |
| `useColorMode` | `useColorMode` de `components/ui/color-mode` (next-themes) | `ui/ColorModeToggle.tsx`, `layout/SidebarNav.tsx`, `auth/.../GoogleSignInButton.tsx` |
| `keyframes` (`@chakra-ui/react`) | `keyframes` de `@emotion/react` (ou CSS animation no recipe) | (só em arquivo deletado — verificar residual) |

### Renomes de prop (varredura global no `src` vivo)

`isDisabled`→`disabled` · `isLoading`→`loading` · `isInvalid`→`invalid` · `isRequired`→`required` · `isOpen`→`open` (componentes Chakra; **não** tocar props de wrapper próprio como `AppModal.isOpen`, preservado por AC-7) · `isChecked`→`checked` · `spacing`→`gap` · `noOfLines`→`lineClamp` · `colorScheme`→`colorPalette` · `isLazy`→`lazyMount`+`unmountOnExit` · `isCentered`→(default v3) · `<Icon as={X} />`→`<Icon><X /></Icon>`.

### Contratos preservados (não podem mudar)

- Chave de localStorage do color mode: `pombo-color-mode`.
- API pública de `useNotify`, `useSidebar`, `useAuth`, e as props de todos os wrappers de `shared/components/{ui,forms,layout}` que sobrevivem.
- Rotas (`ROUTE_PATHS`), chaves de query (`queryKeys`), contratos HTTP e as 3 locales (nenhuma chave de i18n nova é necessária — é refactor, não feature).

## 5. Reuse map (DRY first)

| Necessidade | Peça existente | Path | Ação |
|---|---|---|---|
| Snippets v3 (provider, color-mode, toaster, dialog, drawer, menu, popover, field, native-select, number-input, pin-input, tooltip, avatar, close-button, stat) | Implementação v3 já validada em produção | `~/Documents/repositories/cuidda/apps/web/src/components/ui/*` | **Espelhar** (adaptando nomes/branding do Pombo) |
| Composição do system v3 | `createSystem(defaultConfig, config)` + `globalCss` + `_dark` | `cuidda/apps/web/src/app/theme/index.ts` | **Espelhar** a forma; os valores continuam sendo os do Pombo |
| Provider + Toaster no app | `AppProviders` v3 | `cuidda/apps/web/src/app/providers/AppProviders.tsx` | **Espelhar** |
| `motion(Box)` sob framer-motion 12 | `motion.create(Box)` | `cuidda/apps/web/src/shared/components/animations/*` | **Espelhar** (fm 12 deprecou `motion(Component)`) |
| Setup de teste com React 19 / RTL 16 | matriz de versões validada | `cuidda/apps/web/package.json` | **Copiar versões** |
| Wrappers de produto (`AppModal`, `ConfirmDialog`, `ActionMenu`, `FormField`, `StatCard`, `EntityCard`, ...) | Já existem no Pombo | `apps/web/src/shared/components/**` | **Estender** (trocar o miolo para v3, preservar props) |

Regra: nada é criado do zero se existe equivalente v3 no `cuidda`. Onde o Pombo diverge visualmente (emerald vs azul, tokens próprios), o valor é do Pombo e só a **forma** vem do `cuidda`.

## 6. Files plan

**Create (16)** — `apps/web/src/components/ui/`: `provider.tsx`, `color-mode.tsx`, `toaster.tsx`, `dialog.tsx`, `drawer.tsx`, `menu.tsx`, `popover.tsx`, `field.tsx`, `native-select.tsx`, `number-input.tsx`, `pin-input.tsx`, `tooltip.tsx`, `avatar.tsx`, `close-button.tsx`, `stat.tsx`; + `apps/web/src/shared/contexts/` ganha a forma padronizada (sem arquivo novo) e `.claude/specs/refactor-chakra-v3-standardize-90cd98.md` (este arquivo).

**Modify (~50)** — `apps/web/package.json`, `vite.config.ts` (manualChunks sem `@emotion/styled`), `src/app/theme/**` (index + 6 foundations + recipes), `src/app/providers/AppProviders.tsx`, `src/test/render.tsx`, os 38 arquivos do mapa de §4, mais os arquivos vivos atingidos só por renome de prop, `src/modules/*/index.ts` (5 barrels), `src/shared/contexts/*`, `src/modules/auth/presentation/{context,hooks}/*`, `.claude/patterns/frontend.md`, `.claude/patterns/BASELINE.md` (referências a Chakra v2).

**Delete (56)** — ilha inalcançável a partir de `main.tsx` + specs:

```
src/core/domain/CrudRepository.ts
src/core/http/typedClient.ts
src/core/query/entityQueryKeys.ts
src/shared/components/index.ts
src/shared/components/animations/FadeIn.tsx
src/shared/components/forms/ColorPicker.colors.ts
src/shared/components/forms/ColorPicker.tsx
src/shared/components/forms/CountrySelectField.tsx
src/shared/components/forms/DateField.tsx
src/shared/components/forms/DateFieldPicker.tsx
src/shared/components/forms/DocumentField.tsx
src/shared/components/forms/FileUploadField.tsx
src/shared/components/forms/FileUploadModal.tsx
src/shared/components/forms/MonetaryField.tsx
src/shared/components/forms/MultiSelectField.tsx
src/shared/components/forms/PhoneField.tsx
src/shared/components/forms/PhoneInputField.tsx
src/shared/components/forms/SearchField.tsx
src/shared/components/forms/TimeField.tsx
src/shared/components/forms/TimeFieldPicker.tsx
src/shared/components/forms/datepicker.css
src/shared/components/layout/Topbar.tsx
src/shared/components/skeletons/CalendarSkeleton.tsx
src/shared/components/skeletons/StatCardSkeleton.tsx
src/shared/components/ui/AppBreadcrumb.tsx
src/shared/components/ui/AppTabs.tsx
src/shared/components/ui/AppTimeline.tsx
src/shared/components/ui/BulkActionBar.tsx
src/shared/components/ui/DataTable.tsx
src/shared/components/ui/EditableInfoGrid.tsx
src/shared/components/ui/EntityAvatar.tsx
src/shared/components/ui/FilterButton.tsx
src/shared/components/ui/HorizontalScrollArrow.tsx
src/shared/components/ui/LinkEntityModal.tsx
src/shared/components/ui/ListPageLayout.tsx
src/shared/components/ui/PaginationControls.tsx
src/shared/components/ui/UnlinkButton.tsx
src/shared/components/ui/VerticalScrollArrow.tsx
src/shared/constants/countries.ts
src/shared/constants/messages.ts
src/shared/hooks/useEntityActions.ts
src/shared/hooks/useEntityAvatar.ts
src/shared/hooks/useEntityCreate.ts
src/shared/hooks/useEntityDetail.ts
src/shared/hooks/useEntityList.ts
src/shared/hooks/useHorizontalOverflow.ts
src/shared/hooks/useInfiniteListPage.ts
src/shared/hooks/useListPageController.ts
src/shared/hooks/usePermissions.ts
src/shared/hooks/usePrefetchEntity.ts
src/shared/hooks/useServerSearch.ts
src/shared/hooks/useVerticalOverflow.ts
src/shared/types/address.ts
src/app/theme/components/{menu,modal,number-input,popover,select,tabs}.ts  (conforme §4 — só os cujo estilo migra para snippet/slot recipe)
```

**Exceção deliberada à deleção:** `src/modules/{account,messaging,settings}/index.ts` também são inalcançáveis hoje, mas o barrel de módulo é **API pública por contrato** (`patterns/frontend.md` § Layer Structure: "BARREL — public API (MANDATORY)"). São mantidos e padronizados (AC-10), não deletados.

## 7. Test plan

| AC | Como é verificado |
|---|---|
| AC-1 | `yarn workspace @pombo/web type-check && lint && test && build` (gate do `/finish-task` Fase 6) |
| AC-2, AC-3 | grep no `/finish-task` + `code-auditor` na babysit loop |
| AC-4, AC-5 | Novo `src/components/ui/color-mode.spec.tsx`: `useColorMode` resolve `light` antes do next-themes hidratar e alterna para `dark`; a `storageKey` é `pombo-color-mode` |
| AC-6 | Novo `src/shared/hooks/useNotify.spec.tsx`: `showSuccess`/`showError` publicam no `toaster` com título/descrição corretos; `showError` achata `VALIDATION_ERROR.details` |
| AC-7 | Novo `src/shared/components/ui/AppModal.spec.tsx`: fecha via `onClose`, dispara `onPrimaryAction`, respeita `isPrimaryDisabled`. Os 26 specs existentes continuam verdes sem mudança de assertion (o `render.tsx` passa a montar o Provider v3) |
| AC-8 | Reexecução do script de alcançabilidade (registrado no PR) + `tsc --noEmit` |
| AC-9, AC-10 | Revisão estrutural na babysit loop (`code-reviewer`) |
| AC-11 | Diff do `patterns/frontend.md` conferido contra o `ls` real de `shared/components/**` |
| AC-12 | `yarn workspace @pombo/web test:e2e` (1 spec, docker) |
| AC-13 | Verificação manual em light/dark das telas vivas (sign-in, devices list, device detail, sandbox, profile, api) + `post-edit-frontend.sh` (F-C2/F-C3) |

Specs novos: **3** (`color-mode`, `useNotify`, `AppModal`) — os wrappers de maior risco. Não se escreve spec para componente puramente visual (R27: sem teste especulativo).

## 8. Diff budget

- **Criar:** 15 arquivos (14 snippets + esta spec). **Deletar:** ~56. **Modificar:** ~50-60 + 3 specs novos.
- **Novas deps:** exatamente uma (`next-themes`). **Removidas:** `@chakra-ui/anatomy`, `@chakra-ui/theme-tools`, `@emotion/styled`, `react-datepicker`, `@types/react-datepicker`, `date-fns`. **Upgrades:** `@chakra-ui/react`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `framer-motion`, `@testing-library/react` (+ `@testing-library/dom`).
- **Zero mudança de comportamento visível.** Nenhuma chave de i18n nova, nenhuma rota nova, nenhum endpoint tocado, nenhuma mudança em `apps/api`.
- **Sem refactor de oportunidade** fora de §6 — em especial: não fatiar páginas grandes, não reorganizar `modules/`, não mexer em `core/http` nem em `core/query`.

## Baseline rules in scope

- **R10** (tokens semânticos) — as foundations são reescritas no formato v3; o contrato `bg.*`/`text.*`/`border.*`/`status.*` tem que sair idêntico do outro lado.
- **R11** (sem amarelo/laranja) — `defaultConfig` da v3 traz paletas próprias; nenhum `colorPalette="yellow"/"orange"` pode entrar junto.
- **R15** (rotas por constante, i18n em 3 locales) — refactor não pode introduzir string literal de rota nem texto fora do i18n.
- **R16** (forms pelos primitivos) — `FormField`/`SelectField`/`TextAreaField`/`NumberField`/`PasswordField` continuam sendo a única porta; nenhum `<Input>` cru novo em feature code.
- **R17** (skeleton/empty state) — `ListPageSkeleton`/`DetailPageSkeleton`/`EmptyState` sobrevivem e continuam sendo usados.
- **R19** (`memo` em item de lista) — preservar os `memo()`/`useCallback` existentes ao reescrever.
- **R26/R27/R28** (SDD) — esta spec é o contrato; nada fora dela entra no diff; corte de escopo vai para "Out (deferred)".
- **Fora de escopo:** R1–R9, R20–R25 (backend, migrations, IA, testes de backend).

## Risks & edge cases

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Deletar o scaffolding CRUD genérico (`CrudRepository`, `useEntityList`, `useListPageController`, `ListPageLayout`, `DataTable`) remove o caminho **documentado** para criar um módulo novo | Alta | Médio | AC-11: reescrever a seção "Adding a New CRUD Module" do `frontend.md` para o caminho real (hooks de módulo sobre TanStack Query, como `useDevices.ts`). O `cuidda` mantém as versões v3 dessas peças — recuperáveis por cópia quando um módulo realmente precisar |
| Regressão visual ao trocar os 10 overrides de componente v2 por recipes/snippets | Alta | Médio | Portar o estilo v2 para `slotRecipes` v3 quando ele carrega identidade visual; só descartar o override cujo conteúdo é reproduzível por `defaultConfig` + tokens. Conferência manual light/dark (AC-13) |
| React 19 quebrar uma dep transitiva (`react-datepicker`, `@tiptap/react`, `@react-oauth/google`, RTL) | Média | Alto | Versões copiadas de `cuidda`, que roda essa combinação em produção. `react-datepicker` some junto com a deleção, eliminando um dos riscos |
| `next-themes` fazer flash de tema errado no primeiro paint (o `ColorModeScript` da v2 existia justamente para isso) | Média | Baixo | `attribute="class"` + `disableTransitionOnChange` + `defaultTheme="system"`; `useColorMode` cai para `"light"` explicitamente antes de resolver (padrão do `cuidda`) |
| `motion(Box)` deprecado na framer-motion 12 | Alta | Baixo | Trocar por `motion.create(Box)` nos 8 arquivos vivos que usam |
| Diff gigante (≈120 arquivos) dificultar revisão | Alta | Médio | Implementar em fases commitáveis (§ Execution) e descrever a ordem no corpo do PR |

## Execution (ordem de implementação)

1. **Deps + deleção da ilha morta** — `package.json`, `yarn install`, deletar os 56 arquivos, ajustar `vite.config.ts`. (Deliberadamente primeiro: encolhe a superfície antes de migrar.)
2. **Theme v3** — foundations → tokens v3, recipes/slotRecipes, `createSystem`.
3. **Snippets** — os 15 arquivos de `components/ui/`.
4. **Provider + toaster + color mode** — `AppProviders`, `useNotify`, `ColorModeToggle`, `test/render.tsx`.
5. **Wrappers compartilhados** — `shared/components/{ui,forms,layout}` (o grosso dos 38).
6. **Módulos** — auth, messaging, settings, devices, account.
7. **Varredura de props renomeadas** + `motion.create`.
8. **Padronização** — contexts, barrels.
9. **Docs** — `patterns/frontend.md`, `BASELINE.md`.
10. **Specs novos** + babysit loop + `/finish-task`.

## Decisions log

- [2026-09-14] **Deletar a ilha morta (56 arquivos, ~23% do `src`)** em vez de migrá-la para v3 — resposta do usuário na Decision Round. Racional: corta ~1/3 da superfície de migração e o `cuidda` já tem as versões v3 dessas peças para recopiar sob demanda.
- [2026-09-14] **Espelhar o `cuidda` 1:1**: snippets oficiais em `src/components/ui/*` + `createSystem(defaultConfig, defineConfig)` — resposta do usuário. Racional: convergência real entre os dois frontends, que hoje divergem.
- [2026-09-14] **Padronização = convenções + doc sync**, sem quebrar páginas grandes — resposta do usuário. Fatiar `SandboxPage`/`SignInPage`/`RegisterPage` fica para PR próprio.
- [2026-09-14] **Subir React 19 + framer-motion 12 no mesmo PR** — resposta do usuário, contrariando a recomendação do architect (que era ficar no React 18 para isolar o blast radius). Mitigação: copiar a matriz de versões exata do `cuidda`, que já roda React 19 + fm 12 + Chakra 3.36 em produção.
- [2026-09-14] Defaults do architect aceitados sem segunda rodada: color mode via `next-themes` preservando `pombo-color-mode`; `Select` → `NativeSelect` (paridade 1:1); `useNotify` mantém a API e troca só a implementação; `LanguageSelector` passa a usar `useNotify`; barrels de módulo preservados como API pública; `shared/components/index.ts` deletado (ninguém importa); 3 specs novos só para os wrappers de maior risco; e2e roda no `/finish-task`.
- [2026-09-15] **`stat.tsx` não foi criado.** O snippet seria um re-export puro do namespace `Stat` da v3, sem comportamento próprio e com um único consumidor (`StatCard`) — exatamente a abstração especulativa que `SC-H3` proíbe. `StatCard` usa `Stat.Root`/`Stat.Label`/`Stat.ValueText`/`Stat.HelpText` direto. AC-4 ajustado de 15 para 14 snippets.
- [2026-09-15] **`ToastContent.tsx` foi absorvido pelo `components/ui/toaster.tsx`** em vez de mantido em `shared/hooks/`. A v3 moveu a renderização do toast do call site (`toast({ render })`) para o `<Toaster>`, então o visual passou a ser parte do snippet; e um componente morando em `hooks/` já contrariava a convenção de localização. `useNotify` virou `.ts` (não tem mais JSX) e manteve a API pública.
- [2026-09-15] **O backdrop padrão do `DialogContent` é `blackAlpha.300` + `blur(2px)`**, não o `bg.overlay` do theme v2. Os dois diálogos vivos (`AppModal`, `ConfirmDialog`) já sobrescreviam o valor do theme com esse — ou seja, é o que o app renderiza hoje. O token `bg.overlay` continua existindo, sem consumidor.
- [2026-09-15] **`AppModal.size` perdeu `"2xl"`/`"3xl"`.** A v3 não tem recipe para esses tamanhos, e nenhum call site passava `size` — mantê-los seria expor props que silenciosamente renderizam no tamanho default. A união agora é a da v3 (`xs`…`xl` | `cover` | `full`).
- [2026-09-15] **Override de ESLint para `src/components/ui/**`** desligando `react-refresh/only-export-components`: os snippets co-localizam hook + componente + tipos por design (é a forma upstream), e o projeto roda `--max-warnings 0`. Mesmo override que o `cuidda` usa.
- [2026-09-15] **`e2e.md`, `commands/architect.md` e `commands/frontend.md` também foram sincronizados** (declaravam "React 18 + Chakra UI 2.8"), além de `frontend.md` e `BASELINE.md` previstos no AC-11. São 3 linhas e mantê-las erradas perpetuaria a mesma dessincronia que o AC-11 existe para matar.
- [2026-09-15] **`EmailVerificationPage.spec.tsx` teve o seletor ajustado** (`input[data-part="input"]` em vez de `input`): a v3 renderiza um `hidden-input` extra para submit, então o seletor antigo pegava o elemento errado. As asserções de comportamento (6 campos, `verifyEmailPin` chamado com o código digitado) são as mesmas.
- [2026-09-15] **Correções de teste herdadas do `cuidda`**: `matchMedia` como função simples (um `vi.fn()` é apagado por `vi.clearAllMocks()` e o next-themes passa a ler `.matches` de `undefined`) e stub de `PointerEvent` (o zag da v3 constrói um no blur; sem ele o Vitest sai não-zero com todas as asserções verdes).
- [2026-09-15] **Uma chave de i18n nova: `common.actions.clear`** (pt-BR "Limpar" / en "Clear" / es "Limpiar"), contrariando o "zero chave nova" do §8. O botão de limpar busca do `FilterBar` é icon-only e na v2 não tinha `aria-label` nenhum; ao reescrevê-lo para `InputGroup endElement` eu não ia reintroduzir um controle sem nome acessível. 3 linhas, nas 3 locales.
- [2026-09-15] **Reversão de churn de formatação.** Um `prettier --write` global reformatou 50 arquivos que a tarefa não tocava (o `develop` não estava formatado com o default do prettier). Todos foram restaurados de `origin/develop` — o diff caiu de 210 para 160 arquivos. A formatação só permanece nos arquivos que a migração realmente reescreveu.
- [2026-09-15] **`<Separator flex="1" />` nos divisores "ou"** (SignIn/Register). A v2 renderizava `Divider` como um `<hr>` com `width: 100%`; a v3 usa um `<span>` sem largura, que como flex item colapsa para 0 — as linhas ao lado do "ou" tinham sumido. Regressão visual invisível para o `tsc`, pega na verificação em runtime (`getBoundingClientRect().width === 0`).

### Babysit loop — achados aplicados

- [2026-09-15] **`colorScheme="brand"` sobrevivente no CTA da lista de dispositivos** (auditor, Critical). A v3 remapeia `colorScheme` para a propriedade CSS nativa `color-scheme`, tipada como string livre — passa por `tsc` E por `eslint` enquanto o botão perde a paleta da marca. Corrigido para `colorPalette`, e o padrão virou um gate mecânico: **`F-C21`** no `code-review-checklist.md` + grep no `post-edit-frontend.sh`, porque nenhuma ferramenta de tipo pega essa classe.
- [2026-09-15] **`initialFocusEl` do `ConfirmDialog` não estava aplicando foco** — descoberto ao escrever o teste que o reviewer sugeriu. O `ref` ainda é `null` quando o zag resolve o `initialFocusEl` no commit de abertura; passou a resolver o nó do DOM (`[data-confirm-cancel]`) sob demanda. O teste asseveram a invariante verificável (foco **nunca** no botão destrutivo, então um Enter perdido não confirma), porque o jsdom não reproduz o gerenciamento de foco do zag com fidelidade suficiente para afirmar "foco no Cancelar".
- [2026-09-15] **`aria-label="Close"` do close button não passava por i18n** (auditor, High). O snippet é um primitivo vendorizado e não importa o i18n do app, então o rótulo passou a vir do call site: `AppModal` renderiza `<DialogCloseTrigger aria-label={t("actions.close")} />`.
- [2026-09-15] **`#ffffff` solto no `LanguageSelector`** (auditor, Critical) → token `white`. Isso torna verdadeira a afirmação do `toaster.tsx` de que ele carrega os únicos hex crus fora do theme.
- [2026-09-15] **Doc-drift residual varrido** (auditor High #1/#2/#4 + reviewer Medium #1): `patterns/frontend.md` (prosa em pt-BR sobre `usePrefetchEntity`/`useEntityActions`/`LinkEntityModal`/`StatCardSkeleton`, que contradizia a própria linha 228), `patterns/code-review-checklist.md` (`F-H3`, `F-H6`, `F-H18`, `F-M10`, `F-M14`, `B-M10`, `F-M15`) e os skills `commands/{frontend,fullstack,ui-design}.md`. O AC-11 mirava só a tabela do catálogo; o diff limpou todas as referências ao código deletado nos docs que um próximo agente carrega como verdade.
- [2026-09-15] **Comentários reescritos para não citarem os símbolos banidos por nome** (reviewer Medium #2): o grep literal do AC-2 batia em duas linhas de comentário explicativo. Agora ele retorna vazio de fato.
- [2026-09-15] **Falso positivo rejeitado:** o auditor marcou o token `accent.gold` como adição especulativa que viola o AC-13. Ele já existia idêntico em `origin/develop` (`semantic-tokens.ts:184`, com o mesmo comentário de exceção); esta tarefa só o converteu para o formato v3. Removê-lo seria scope creep sobre o design system, fora do contrato desta spec.
- [2026-09-15] **Script de boot removido do `apps/web/index.html`** (Fase 5, High). Ele forçava light em todo carregamento: gravava `chakra-ui-color-mode` (chave que ninguém lê — a real é `pombo-color-mode`), setava `data-theme` (o next-themes usa `class`) e `style.colorScheme`. Pré-existente ao PR, mas contradizia frontalmente o **AC-5**: um usuário que escolheu dark levava flash de light em toda visita. Fora do §6, então fica registrado aqui — é deleção de código comprovadamente morto que estava sabotando um AC desta própria spec.
- [2026-09-15] **A Fase 5 pegou um gap de staging, não de código.** O `git add -A` tinha rodado ANTES da babysit loop; as 21 correções seguintes (incluindo o próprio fix do `colorScheme`, a regra `F-C21` no hook, a entrada no checklist e a limpeza dos docs de skill) estavam só na working tree. O índice — que é o que vira commit — teria ido sem nenhuma delas. Tudo re-staged e re-verificado contra o índice, não contra a working tree.
- [2026-09-15] Artefatos de execução do e2e (`.playwright/report/index.html`, `.playwright/results/.last-run.json`) restaurados/removidos do commit: são subproduto da verificação do AC-12, não código.

