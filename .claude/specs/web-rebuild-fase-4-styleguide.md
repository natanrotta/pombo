# Task Spec — web-rebuild-fase-4-styleguide

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (uma fase por commit) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Medium |
| **Specialist** | /frontend |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 4 (D7) — **parte estrutural** |

## 1. Goal
Dar ao redesign uma rede de segurança visual e seletores estáveis: uma galeria só de desenvolvimento com todos os primitivos compartilhados em todos os estados, snapshots Playwright dela em claro e escuro, e `data-cy` nos primitivos interativos que não têm seletor semântico único.

## 2. Scope
**In:**
- Rota DEV-only `/dev/styleguide` (`ROUTE_PATHS.styleguide`, montada só com `import.meta.env.DEV`, como no `cuidda`) no módulo `development`, dentro do shell autenticado.
- A galeria renderiza, por seção com `data-cy="styleguide-<seção>"`: tipografia (`textStyles`), cores e sombras semânticas (lidas do `@pombo/theme`, atualizam sozinhas com o design), botões (variantes × tamanhos × desabilitado/carregando), badges de status, campos (padrão, ajuda, erro, desabilitado, senha, select, número, textarea, força de senha), cards (`SectionCard` 3 variantes, `EntityCard`, `StatCard` tons, `InfoRow`), estados (`EmptyState`, skeletons), controles (`PageHeader`, `FilterBar`, `ActionMenu`, `CopyButton`, `SaveButton`, `ColorModeToggle`, `LanguageSelector`) e gatilhos de overlay (`AppModal`, `ConfirmDialog`, toast × 4).
- `e2e/tests/design-system/styleguide-visual.spec.ts`: `toHaveScreenshot` de cada seção e dos overlays abertos em claro e escuro, snapshots versionados.
- Playwright lê `data-cy` em `getByTestId` (`testIdAttribute`); o único `data-testid` do app vira `data-cy`.
- `data-cy` em: `AppModal` (conteúdo, cancelar, ação primária), `ConfirmDialog` (conteúdo, cancelar, confirmar), `EntityCard` (raiz), `PageHeader` (ação primária), `FilterBar` (busca), `SaveButton`, `EmptyState` (ação), `LanguageSelector` (cada idioma), menu do usuário no sidebar (gatilho, sair).
- A11y achada no caminho: botões de idioma sem nome acessível (ganham `aria-label` e `aria-pressed`; o seletor nunca fica dentro de um `<form>`, então o `type` padrão não importa — e `Flex as="button"` não aceita `type`); busca do `FilterBar` sem rótulo (ganha `aria-label`).

**Out (deferred):**
- Reconciliar os componentes com o design (bloqueado na Fase 0) — a galeria e os snapshots são exatamente o que essa passada vai usar.
- Snapshots Linux para o CI (Fase 10 — os snapshots daqui são `darwin`).
- `data-cy` em campos rotulados e itens de menu com texto (o seletor semântico já é único).

## 3. Acceptance criteria
- **AC-1** — Em dev, `/dev/styleguide` renderiza todas as seções do escopo; em produção a rota não é montada e o bundle não contém o código da página (grep no `dist`: só a constante do caminho em `ROUTE_PATHS` aparece).
- **AC-2** — `styleguide-visual.spec.ts` passa em claro e escuro com os snapshots versionados e falha se um token visual mudar (sonda).
- **AC-3** — `getByTestId` do Playwright encontra `data-cy`; nenhum `data-testid` sobra no `src`.
- **AC-4** — Os primitivos listados têm `data-cy`; os botões de idioma e a busca do `FilterBar` têm nome acessível.
- **AC-5** — Gates verdes (type-check, lint, test, build:web, e2e) e nenhuma mudança visual nas telas.

## 4. Contracts & interfaces
N/A — nenhum contrato novo de API; a única superfície nova é a rota DEV-only `ROUTE_PATHS.styleguide`.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Galeria DEV-only | `StyleguidePage` + rota condicional | `cuidda/apps/web/src/modules/development`, `AppRouter.tsx` | espelhar a forma |
| Leitura dos tokens | `semanticTokens`, `textStyles` | `@pombo/theme` | consumir |
| Coleta de folhas de token | `collectLeaves` do spec de contrato | `app/theme/tokenContract.spec.ts` | não compartilhar (spec x runtime); a galeria tem sua versão enxuta |

## 6. Files plan
**Create:** `apps/web/src/modules/development/{index.ts,presentation/pages/StyleguidePage.tsx}`, `apps/web/e2e/tests/design-system/styleguide-visual.spec.ts`, os snapshots, esta spec.
**Modify:** `apps/web/playwright.config.ts`, `apps/web/vite.config.ts`, `shared/components/ui/AppModal.spec.tsx`, `e2e/fixtures/screenshot.css` (novo), `app/router/{RoutePaths,AppRouter}.tsx`, `components/ui/toaster.tsx`, `shared/components/ui/{AppModal,ConfirmDialog,EntityCard,PageHeader,FilterBar,SaveButton,EmptyState,LanguageSelector}.tsx`, `shared/components/layout/SidebarNav.tsx`, `.claude/patterns/{e2e,frontend}.md`, `apps/web/README.md`.

## 7. Test plan
AC-1 → navegação no preview + grep no `dist` + o plugin de build `pombo:dev-only-modules-excluded` (falha se um módulo de `modules/development` entrar num chunk). AC-2 → o próprio spec visual + sonda (mudar um token e ver falhar). AC-3/AC-4 → grep + e2e. Correção do `ConfirmDialog` → teste unitário em `AppModal.spec.tsx`. AC-5 → gates + captura das telas.

## 8. Diff budget
~5 arquivos criados + snapshots, ~13 modificados. Nenhuma dependência nova.

## Decisions log
- [2026-09-16] Parte estrutural só: o handoff continua inacessível.
- [2026-09-16] Rota `/dev/styleguide` e módulo `development`, espelhando o `cuidda` (o roadmap dizia `/dev/design-system`; paridade entre os repos vence).
- [2026-09-16] Convenção de seletor de teste = `data-cy` (3 dos 4 atributos existentes, e o que o roadmap pede), com `testIdAttribute: "data-cy"` para o `getByTestId` continuar sendo o último recurso documentado no `e2e.md`.
- [2026-09-16] A galeria é ferramenta de desenvolvimento, não tela de produto: textos de demonstração ficam literais em pt-BR (como no `cuidda`), fora do i18n.
- [2026-09-16] **A galeria achou um defeito real e antigo:** o recipe `solid` pinta com os tokens da marca e ignora `colorPalette`, então o botão de confirmar do `ConfirmDialog` (`colorPalette="red"`) saía **verde** numa exclusão. Corrigido espalhando os estilos da variante `danger` do próprio recipe (a variante não existe nos tipos gerados do Chakra, e nem o `cuidda` roda typegen). O botão "Excluir" do detalhe do device tem o mesmo sintoma (`variant="outline" colorPalette="red"` com texto verde) — fica para a Fase 7, que reconstrói essa tela.
- [2026-09-16] Toast ganhou `data-cy="toast"` (necessário para o snapshot) e o `playwright.config.ts` ganhou `stylePath` escondendo o botão do devtools do TanStack Query nas capturas.
- [2026-09-16] **Limiar de comparação apertado** (`threshold: 0.02`, `maxDiffPixelRatio: 0.002`): com o padrão (0.2), a sonda que trocou `bg.surface` de branco para um lilás claro passou despercebida; com o limiar novo ela falhou (90% dos pixels). Baselines regenerados e estáveis em 3 execuções seguidas.
- [2026-09-16] AC-2 provado: sonda em `bg.surface` quebrou o spec visual.
- [2026-09-16] Auditor (nível 1) limpo em Critical/High. O Medium aceito: a correção do `ConfirmDialog` ganhou guarda no Vitest, porque o spec visual ainda não roda no CI (Fase 10). jsdom não calcula cores, então o teste lê as regras que o emotion injetou para a classe do botão.
- [2026-09-16] Revisor (nível 2) limpo em Critical/High; os dois Medium aceitos. (1) O `ConfirmDialog` troca o espalhamento dos estilos da variante `danger` pela própria variante (`variant={(isDanger ? "danger" : "solid") as "solid"}`, o mesmo cast da galeria): o estilo volta para o `@layer recipes` e o teste fica sem parser de camadas. Sondas: o código antigo (`colorPalette="red"`), o `danger` sempre ligado e a variante renomeada quebram, cada um, um dos testes. (2) AC-1 virou gate: plugin de build que falha se `modules/development` entrar no bundle; sonda (remover o `import.meta.env.DEV`) quebrou o build. O Low (`aria-pressed` → `aria-current` no seletor de idioma) fica como está: são botões de alternância, e `aria-pressed` é o padrão ARIA para isso.
- [2026-09-16] `/code-review` final (Fase 5 do `/finish-task`): 0 Critical/High. Medium 1 (`data-cy="entity-card"` fixo num item de lista) aceito — id repetido por item é a convenção, e o `e2e.md` agora manda escopar com `.filter({ hasText })`. Medium 2 (o plugin não olha assets) não se aplica: um asset só entra no bundle se o módulo que o importa entrar, e aí o chunk desse módulo já dispara o erro. Low (tipos reais do Rollup no plugin) mantido estrutural, pelo mesmo motivo do plugin vizinho: o monorepo tem duas cópias do Vite e tipos nominais quebram a checagem.
- [2026-09-16] Gates finais verdes: type-check, lint, `yarn test` (api 879, web 109), `build:web`, e2e 17/17 (inclui o snapshot do `ConfirmDialog` com a variante `danger`).
