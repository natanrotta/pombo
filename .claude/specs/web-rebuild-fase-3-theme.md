# Task Spec — web-rebuild-fase-3-theme

| | |
|---|---|
| **Status** | approved |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (commit próprio) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Medium (muda todas as telas de uma vez) |
| **Specialist** | /frontend |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 3 (destravada: o handoff ficou acessível) |
| **Handoff** | `Pombo Design Foundation.dc.html` e `Pombo Home.dc.html` (projeto de design `f0e6e630`) |

## 1. Goal
Levar a fundação do handoff para `@pombo/theme` sem renomear nenhum token semântico, de modo que todas as telas mudem de cara ao mesmo tempo e nenhum componente precise ser reescrito nesta fase.

## 2. Fundação (o que o handoff define)
Escuro, estilo terminal. Superfícies `#0B0E0D` (fundo), `#0E1211` (painel), `#16211B` (ativo/verde), bordas `#1C2220` e `#223A2C`, acento `#3FE08A` (hover `#6BF0AB`, tinta sobre o acento `#07130C`). Tinta `#E8EDEA` / `#9AA8A2` / `#8B9A93` / `#5A6862`. Status: online verde, offline `#FF7A6B` sobre `#1F1413`/`#3A211E`, pareando `#F0C860`, enviando `#7AB8FF` sobre `#101725`/`#22314A`. Tipografia IBM Plex Sans (corpo 13,5–15px) e IBM Plex Mono (título de página 27px minúsculo + ponto verde, título de card 14,5px/500, rótulo 10px maiúsculo com tracking, números e tokens). Raios 6/8/9/10px. Transições de 150ms; animação contínua só em estado vivo (glow do online, pulse do pareando). Textura de pontos verdes a 5,5%, 22px, no fundo.

## 3. Decisões do usuário (2026-09-16)
- **Claro e escuro continuam.** O handoff só define o escuro; o claro é derivado aqui a partir das mesmas famílias, e o contrato de tokens segue exigindo `_dark` em todo semântico.
- **Sem amarelo.** A regra do projeto (R11 / `F-C3`) vence o `#F0C860`: "pareando" passa a usar o azul `#7AB8FF` do próprio handoff (o tom de "enviando"), via `status.info`. `status.warning` continua roxo, para os avisos de toast não ficarem iguais aos informativos.
- **Alcance:** tema agora; a Home vem no commit seguinte; as outras quatro telas depois.

## 4. Scope
**In:** `packages/theme/src/foundations/*` (cores, semânticos, tipografia, raios, sombras, receitas de button/badge/input/textarea), fontes IBM Plex auto-hospedadas (`@fontsource`), `apps/web/index.html` (sai o Google Fonts), `app/theme/index.ts` (textura de pontos no `globalCss`), `DeviceStatusBadge` (pareando → `info`), galeria `/dev/styleguide` e baselines visuais.

**Out:** layout das telas (Home vem depois), qualquer mudança de componente além do necessário para os tokens novos, contador "na fila" (commit próprio, precisa da API).

## 5. Acceptance criteria
- **AC-1** — Nenhum token semântico renomeado ou removido: `tokenContract.spec.ts` continua verde (todo semântico com `_dark`, nenhum tom quente, nenhum token referenciado inexistente).
- **AC-2** — No escuro, os valores batem com o handoff: fundo `#0B0E0D`, painel `#0E1211`, borda `#1C2220`, acento `#3FE08A`, tinta `#E8EDEA`.
- **AC-3** — O claro é derivado das mesmas famílias e mantém AA em texto principal, secundário e no botão primário.
- **AC-4** — Corpo em IBM Plex Sans e títulos/rótulos/números em IBM Plex Mono, com as fontes servidas pelo próprio bundle (sem requisição ao Google).
- **AC-5** — "Pareando" e "conectando" usam o azul; nenhum amarelo/laranja/âmbar entra no tema.
- **AC-6** — Galeria e baselines atualizadas; `yarn test`, `yarn test:e2e`, type-check, lint e `build:web` verdes.

## 6. Files plan
**Modify:** `packages/theme/src/foundations/{colors,semantic-tokens,typography,text-styles,radii,shadows,recipes}.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app/theme/index.ts`, `apps/web/src/modules/devices/presentation/components/DeviceStatusBadge.tsx`, `apps/web/package.json` (+`@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`), baselines em `apps/web/e2e/tests/__screenshots__/`.

## 7. Test plan
`tokenContract.spec.ts` (guarda o contrato), specs existentes de recipes/tema, `yarn test`, `yarn test:e2e` com baselines regeneradas e conferidas a olho, `build:web`.

## 8. Diff budget
Uma fase de valores: ~8 arquivos de tema + 4 de app + baselines. Duas dependências novas (as duas fontes).

## Decisions log
- [2026-09-16] Nenhum token semântico foi renomeado: só os valores mudaram, então todas as telas adotaram o novo visual de uma vez, sem reescrever componentes. `bg.field` (campo mais escuro que o painel, como no handoff) e `bg.brand.subtle-hover` são os únicos tokens novos.
- [2026-09-16] "Pareando" e "conectando" passaram de `warning` (roxo) para `info` (azul `#7AB8FF`), e `desconectado` virou vermelho, como as três cores de status do handoff. `warning` continua roxo para os avisos de toast não ficarem iguais aos informativos.
- [2026-09-16] O `danger` do botão deixou de usar `red.500` cru e passou a usar `status.error.solid` — resolve uma das pendências de cor crua da 10d.
- [2026-09-16] A lista de tokens com valor igual nos dois modos (`tokenContract.spec.ts`) ficou vazia: os brilhos decorativos e as sombras de marca agora também diferem entre claro e escuro.
- [2026-09-16] Fontes IBM Plex servidas pelo bundle (`@fontsource`), como manda a D8 do roadmap; o `index.html` não chama mais o Google Fonts.
