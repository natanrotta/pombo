# Task Spec — web-rebuild-home-devices

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (commit próprio, depois da Fase 3) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Medium |
| **Specialist** | /frontend |
| **Handoff** | `Pombo Home.dc.html` (projeto de design `f0e6e630`) |

## 1. Goal
A tela de dispositivos com o layout do handoff: título em minúsculo com ponto verde, bloco de contadores, barra de filtro com prompt `/`, cartões em grade ou linhas em lista, e o card tracejado de conectar número.

## 2. Scope
**In:** `DevicesListPage` (grade/lista, seletor de status, contadores), `EntityCard` (borda viva, ação no hover, tipografia do handoff), `PageHeader` (título mono minúsculo + ponto), `FilterBar` (prompt `/` e espaço para o seletor), novos `StatTiles`, `ViewToggle`, `InlineSelect`, `DeviceRow` e `useDeviceSummary`; sidebar com rótulos mono e item ativo delineado; padding do conteúdo (34/40) do handoff; galeria e baselines.

**Out:** contador "na fila" (precisa da API — commit próprio), atalhos de teclado (decisão do usuário), demais telas.

## 3. Acceptance criteria
- **AC-1** — A Home mostra contadores, filtro, grade e lista como no handoff, em claro e escuro.
- **AC-2** — A escolha entre grade e lista sobrevive ao recarregar (preferência do navegador, como a sidebar).
- **AC-3** — Cada estado de dispositivo lê igual no card e na linha (`useDeviceSummary`); o conectado tem borda verde e respira.
- **AC-4** — Nada quebra no mobile: contadores em duas colunas, barra em linha própria, navegação inferior livre.
- **AC-5** — type-check, lint e `build:web` verdes; baselines visuais regeneradas e conferidas.

## Decisions log
- [2026-09-16] O ponto verde do título é decorativo: fica com `aria-hidden` para não entrar no nome acessível (os testes e leitores de tela continuam lendo só "Dispositivos").
- [2026-09-16] `StatCard` (com ícone e dica) saiu: o handoff usa um bloco único de contadores. A galeria passou a mostrar `StatTiles` e o `ViewToggle`.
- [2026-09-16] "Desconectado" passou a ser vermelho e "pareando" azul, seguindo as três cores de status do handoff (sem amarelo).
- [2026-09-16] O `ViewToggle` é um `chakra.button` com o ícone em tamanho fixo: dentro de um `IconButton` o glifo do lucide encolhia para o tamanho de um ponto.
