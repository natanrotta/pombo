# Task Spec — web-rebuild-fase-5-app-shell

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (uma fase por commit) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Low |
| **Specialist** | /frontend |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 5 — **parte estrutural** |

## 1. Goal
Deixar o shell autenticado pronto para receber o design: a sidebar dividida em peças pequenas, a marca num componente só, estados de carregamento em skeleton no lugar do spinner e da área vazia, e o i18n do shell completo. Sem mudança visual fora dos estados de carregamento.

## 2. Scope
**In:**
- `SidebarNav` (330 linhas) dividido em `BrandMark`, `SidebarNavItems` (item com `memo()`, `<nav>` com `aria-label` i18n) e `SidebarUserMenu`, todos em `shared/components/layout/`; o `SidebarNav` compõe as três peças e o botão de recolher. Mesmo DOM e comportamento; `data-cy` do menu do usuário e a chave `@pombo-web:sidebar-collapsed` mantidos.
- `BrandMark` (logo + nome i18n) compartilhado entre a sidebar e o `MobileHeader` (o header escreve "Pombo" fixo duas vezes).
- `ProtectedRoute`: `AppShellSkeleton` (novo, em `shared/components/skeletons/`) no lugar do `<Spinner>` de tela cheia — coluna da sidebar no `lg` com a largura recolhida/expandida do `useSidebar`, header no mobile, placeholder do conteúdo.
- `RouteFallback`: skeleton de conteúdo que só aparece após um atraso curto (atraso de animação CSS, sem timer JS), no lugar de `<Box minH="40vh" />`.
- i18n: remover os textos padrão redundantes de `t(chave, padrão)` (`NotFoundPage`, `SidebarNav`); `aria-label="Main navigation"` fixo do `MobileBottomNav` vira chave nova `layout.mainNavigation` (pt-BR/en/es), usada também pela sidebar.

**Out (deferred):**
- Visual do shell, posição de tema/idioma e visual da `NotFoundPage` conforme o design (bloqueado na Fase 0).
- Renomear o barrel de ícones (116 aliases `Fi*`): churn amplo sem ganho sem o design.
- Chaves órfãs do sidebar em `common.json` (`copyCode`, `shareCode`, `devOpenWelcome`): varredura de i18n da Fase 10.
- Testes: e2e de navegação (AC-5.2) e snapshots do shell (AC-5.3) vão para a Fase 10 (AC-10.5), por decisão do usuário.

## 3. Acceptance criteria
- **AC-1** — `SidebarNav.tsx` só compõe; cada peça tem uma responsabilidade; recolher/expandir, tooltips no modo recolhido, item ativo, menu do usuário (perfil, tema, sair, versão) e o drawer mobile (`forceExpanded` + `onNavigate`) funcionam como antes.
- **AC-2** — Logo e nome da marca vêm de um único `BrandMark`; nenhum "Pombo" literal no shell.
- **AC-3** — Durante a checagem de sessão, a tela mostra o esqueleto do shell (nada de spinner); a largura da coluna acompanha o estado recolhido.
- **AC-4** — Enquanto um chunk de rota carrega, um skeleton de conteúdo aparece só depois do atraso; carregamentos rápidos não piscam.
- **AC-5** — Nenhum `t(chave, "padrão")` no shell; os dois `<nav>` do shell têm nome acessível i18n nas 3 locales.
- **AC-6** — `type-check`, `lint` e `build:web` verdes.

## 4. Contracts & interfaces
N/A — sem contrato de API. Props: `SidebarNavItems { isCollapsed, onNavigate? }`, `SidebarUserMenu { isCollapsed }`, `BrandMark { variant: "sidebar" | "header", isCollapsed? }`. `SIDEBAR_WIDTH` (`shared/constants/layout.ts`) é a largura única da sidebar para o `AppShell`, o drawer e o skeleton.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Lista de navegação | `navigationSections` | `shared/components/layout/navigation.ts` | consumir |
| Blocos de skeleton | `Skeleton`, `SkeletonCircle`, `DetailPageSkeleton variant="single"` | `@chakra-ui/react`, `shared/components/skeletons/` | compor |
| Estado da sidebar | `useSidebar` | `shared/contexts/useSidebar.ts` | consumir |
| Fade atrasado | keyframe `fade-in` do Chakra | preset padrão | `animationName` + `animationDelay` |

## 6. Files plan
**Create:** `shared/components/layout/{SidebarNavItems,SidebarUserMenu,BrandMark}.tsx`, `shared/components/skeletons/{AppShellSkeleton,RouteContentSkeleton}.tsx`, `shared/constants/layout.ts`, esta spec.
**Modify:** `shared/components/layout/{SidebarNav,MobileHeader,MobileBottomNav,AppShell}.tsx`, `app/router/{AppRouter,NotFoundPage}.tsx`, `app/router/guards/ProtectedRoute.tsx`, `shared/i18n/locales/{pt-BR,en,es}/common.json`, `.claude/patterns/frontend.md` (catálogo de skeletons/shell).

## 7. Test plan
Por decisão do usuário (roadmap §7), nenhum teste é escrito ou executado nesta fase. Gates: `type-check`, `lint`, `build:web`. AC-5.2/AC-5.3 → Fase 10.

## 8. Diff budget
~6 arquivos criados, ~10 modificados. Nenhuma dependência nova.

## Decisions log
- [2026-09-16] Parte estrutural só: o handoff continua inacessível.
- [2026-09-16] Testes da fase adiados para a Fase 10 (pedido do usuário).
- [2026-09-16] As peças ficam planas em `layout/` (a pasta já é plana; o `cuidda` não tem subpasta de sidebar).
- [2026-09-16] Fallback de rota atrasado por CSS (`animationDelay`), não por timer: nada de estado nem de efeito para um placeholder.
- [2026-09-16] Sem `SidebarBrand`: seria um `<Box px={1}>` em volta do `BrandMark` com um único consumidor (R27). O `SidebarNav` usa o `BrandMark` direto.
- [2026-09-16] As larguras da sidebar (`68px`/`248px`) viraram `SIDEBAR_WIDTH`: o skeleton do shell precisa das mesmas do `AppShell` e do drawer.
- [2026-09-16] Nome e tagline recolhidos saem do DOM (render condicional) em vez de `display: none` com uma transição de opacidade que nunca rodava; o visual é o mesmo. O `role="navigation"` redundante do `MobileBottomNav` saiu (o `<nav>` já tem o papel).
- [2026-09-16] O logo do `BrandMark` tem `alt` vazio quando o nome aparece ao lado (evita o leitor de tela anunciar "Pombo Pombo") e `alt` com o nome quando está recolhido.
- [2026-09-16] Babysit: auditor 0 Critical/High/Medium (1 Low: dois `<nav>` com o mesmo nome — não se expõem juntos: o drawer fechado fica `hidden` e o aberto é modal); revisor 0 achados. Para a Fase 10: um e2e de acessibilidade que garanta um único landmark de navegação exposto por viewport.
- [2026-09-16] `/duck-debug` não rodou: o roadmap (§7) só o exige nas Fases 3, 4, 6 e 11, e a fase é uma divisão de componentes sem lógica nova.
- [2026-09-16] `/code-review` final: 0 Critical/High/Medium; o Low (landmarks com o mesmo nome) é o mesmo já rastreado acima. Gates: `type-check`, `lint`, `build:web` verdes; testes não rodados (decisão do usuário).
