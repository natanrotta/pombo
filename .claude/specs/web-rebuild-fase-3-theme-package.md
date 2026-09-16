# Task Spec — web-rebuild-fase-3-theme-package

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (uma fase por commit) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Medium (toca estilo de todas as telas) |
| **Specialist** | /frontend |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 3 (D3) — **parte estrutural** |

## 1. Goal
Deixar a fundação visual do Pombo num pacote próprio (`@pombo/theme`), com o app só compondo o sistema e nenhuma cor fixa fora do tema — de forma que aplicar o handoff de design vire uma troca de valores dentro do pacote, verificada por um spec de contrato de tokens.

## 2. Scope
**In:**
- `packages/theme` (`@pombo/theme`), só código-fonte, espelho estrutural do `@cuidda/theme`: `pomboThemeConfig` (tokens, semanticTokens, textStyles, recipes) + reexport de `fieldBase` e das foundations.
- As foundations de `apps/web/src/app/theme/foundations` vão para o pacote; `apps/web/src/app/theme/index.ts` compõe `createSystem(defaultConfig, pomboThemeConfig, appConfig)`, com `appConfig` só com `globalCss`.
- Zero hex/rgba fora do tema: `toaster` usa `status.*` (novo `status.*.solid`) e `shadow.panel`; os brilhos e sombras decorativos de `SignInPage`/`RegisterPage` usam tokens novos; o `ColorModeToggle` perde as condicionais de cor por modo (tokens com `_dark`); o botão `danger` usa o token de núcleo `white` (não `text.onBrand`, cujo valor escuro falharia contraste no vermelho).
- Spec de contrato de tokens: todo token semântico tem `base` e `_dark`; nenhum valor do tema cai na faixa amarelo/laranja/âmbar; todo nome de token usado no `src` do app **e** no próprio pacote (recipes, referências `{colors.…}` entre tokens) existe no sistema.

**Out (deferred):**
- **Trocar os valores pelos do handoff de design** (paletas, tipografia, raios, sombras, recipes novos) — bloqueado na Fase 0; vira a "passada visual" quando o arquivo estiver acessível.
- Fontes self-hosted (D8) — depende do design.
- Mover `globalCss` para o pacote (é superfície do app).

## 3. Acceptance criteria
- **AC-1** — `packages/theme` existe e passa no `type-check`; `apps/web/src/app/theme/foundations/` não existe; o app importa `pomboThemeConfig`/`fieldBase` de `@pombo/theme`.
- **AC-2** — `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" apps/web/src --include=*.ts --include=*.tsx` só encontra `apps/web/src/app/theme/index.ts` (fundos do `globalCss`) e specs.
- **AC-3** — Nenhuma condicional de cor por modo em componente; `useColorMode` só é lido onde o estado importa (ícone/label do toggle, sidebar, SDK do Google).
- **AC-4** — Toasts usam tokens de status e trocam de cor no modo escuro.
- **AC-5** — O spec de contrato de tokens passa e falha se um token semântico perder o `_dark` (ou repetir o valor claro fora da lista de exceções), se entrar um valor amarelo/laranja/âmbar (hex, rgb, cor nomeada ou paleta) ou se o app/pacote usar um token inexistente.
- **AC-6** — Gates verdes (type-check, lint, test, build:web, e2e) e captura claro/escuro sem mudança além das listadas no Decisions log.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Pacote de tema só-fonte | `@cuidda/theme` | `~/Documents/repositories/cuidda/packages/theme` | espelhar `package.json`, `tsconfig`, `index.ts` |
| Contrato de token por varredura do `src` | `zIndexTokenContract.spec.ts` | `cuidda/apps/web/src/app/theme/` | espelhar a varredura para cor/sombra/textStyle |
| Cores de status | `status.{success,info,warning,error}.{fg,bg,border}` | foundations `semantic-tokens.ts` | estender com `solid` |

## 6. Files plan
**Create:** `packages/theme/{package.json,tsconfig.json,src/index.ts}`, `apps/web/src/app/theme/tokenContract.spec.ts`, esta spec.
**Move:** `apps/web/src/app/theme/foundations/*` → `packages/theme/src/foundations/*`.
**Modify:** `apps/web/package.json`, `apps/web/src/app/theme/index.ts`, `apps/web/src/components/ui/{toaster,number-input,native-select}.tsx`, `apps/web/src/shared/components/ui/ColorModeToggle.tsx`, `apps/web/src/modules/auth/presentation/pages/{SignInPage,RegisterPage}.tsx`, docs (`patterns/frontend.md`, `BASELINE.md` R10, `commands/frontend.md`, `hooks/post-edit-frontend.sh` (comentário), `README.md` raiz, `apps/web/README.md`).

## 7. Test plan
AC-5 → `tokenContract.spec.ts` (com sonda negativa temporária para provar que falha). AC-1/AC-2/AC-3 → grep + type-check. AC-4/AC-6 → captura claro/escuro das telas + toast forçado na galeria local, gates.

## 8. Diff budget
~5 arquivos criados, 7 movidos, ~12 modificados. Nenhuma dependência externa nova (só o workspace `@pombo/theme`).

## Decisions log
- [2026-09-16] Fase executada **só na parte estrutural**: o handoff continua inacessível (MCP sem `/design-login`, Chrome desconectado). Os valores atuais (emerald) ficam; o roadmap previa `/architect` para esta fase por causa da troca de valores, que foi adiada — a parte restante é M e segue com `/frontend`.
- [2026-09-16] Pacote consumido como código-fonte (`main`/`types` → `src/index.ts`), como o `@cuidda/theme`; não precisa de build.
- [2026-09-16] **Mudanças visuais aceitas:** (1) os brilhos decorativos e a sombra do logo das telas de auth saem do azul/teal da marca anterior para o emerald atual (eram a única superfície com a identidade antiga); (2) o halo do switch de tema no escuro sai do índigo (fora da paleta) para emerald; (3) toasts passam a usar `status.*` — no claro trocam o verde-emerald por `green` do status e o texto 800 pelo `fg` 600; no escuro ganham superfície escura com tinta de status (AC-4). O diff de pixels da captura Fase 1 → Fase 3 só acusa as telas de auth (≤0,13%).
- [2026-09-16] O toast compõe `bg.elevated` + a tinta `status.*.bg` via `backgroundImage` (referência `{colors.…}`, resolvida pela v3): no escuro a tinta é translúcida e um toast flutuante não pode deixar a página aparecer por baixo.
- [2026-09-16] A tabela de tokens do `patterns/frontend.md` listava valores do tema azul antigo e sombras inexistentes (`card`, `card-hover`), e `commands/frontend.md` recomendava `boxShadow: "card-hover"` — que o spec novo reprova. Os dois foram corrigidos para os nomes reais.
- [2026-09-16] O spec de contrato foi provado com três sondas temporárias (token sem `_dark`, valor âmbar, token inexistente num componente): as três quebraram o teste.
- [2026-09-16] Babysit nível 1: auditor achou 1 High — o toast montava nomes de token por template string, invisíveis ao spec (o `StatCard` tinha o mesmo formato). Corrigido nos dois lados: o `STATUS_CONFIG` do toast guarda nomes de token literais, e o spec passou a varrer qualquer string com forma de token semântico (`bg|text|border|status|shadow.*`) — ela precisa existir como token ou como chave de i18n. Provado com sonda (`status.success.tintX`, `text.brandX` quebraram o teste). Lows: `yarn.lock` removido do files plan (dependência de workspace não entra no lockfile do yarn 1); `jsx` no `tsconfig` do pacote não é necessário (sem JSX).
- [2026-09-16] Babysit nível 2: revisor 1 High — o scan de nomes de token só cobria `apps/web/src`, e os recipes do pacote citam ~25 tokens por nome. O spec passou a varrer `packages/theme/src` também (o que ainda valida as referências `{colors.…}` entre tokens semânticos), com asserção de que o pacote está no escopo; provado com sonda (`boder.default` num recipe e `{colors.bg.mutedX}` num token quebraram o teste). Low aceito: o pacote não tem `lint` (só type-check + o spec); fica para quando crescer além das foundations.
- [2026-09-16] Babysit nível 3 (`/duck-debug`): **CLEAN**, depois de fechar duas lacunas que a rodada expôs no próprio spec — (1) paletas quentes nativas do Chakra (`orange.500`) eram "tokens conhecidos" e passavam; agora são rejeitadas em props, referências e `colorPalette`, e cores nomeadas quentes (`gold`) são rejeitadas nos valores do tema; (2) tokens com claro = escuro precisam estar na lista `SAME_IN_BOTH_MODES`. As duas provadas com sondas.
- [2026-09-16] `/finish-task` Fase 5 (revisão independente): 1 High, mesma classe pela terceira vez — o teste de tom quente não lia os recipes, que escrevem sombras rgba e nomes de paleta à mão. O teste passou a varrer `badgeRecipe`, `buttonRecipe`, `fieldBase`, `inputRecipe` e `textareaRecipe` (cor literal, cor nomeada e paleta quente); sonda com `orange.500` e uma sombra âmbar no botão quebrou o teste. Lição registrada: cada asserção de um spec de contrato precisa ter o próprio escopo conferido, não só o arquivo.
