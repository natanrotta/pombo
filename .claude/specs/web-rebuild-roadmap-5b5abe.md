# Task Spec — web-rebuild-roadmap-5b5abe

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` |
| **Date** | 2026-09-16 |
| **Size / Risk** | S / Low (documentation only — no code) |
| **Specialist** | — (planning deliverable; no implementing specialist) |

## 1. Goal

Produzir o roadmap completo da reconstrução do `apps/web` (tema, design e arquitetura) a partir de um inventário factual do frontend atual e do contrato HTTP do `apps/api`, para que o usuário revise o plano antes de qualquer implementação. O documento é o único artefato deste PR.

## 2. Scope

**In:**
- `docs/web-rebuild/roadmap.md` — diagnóstico, contrato com o backend, decisões de arquitetura, fases com critérios de aceite, decisões em aberto, sequenciamento, riscos, apêndices.
- Esta spec.

**Out (deferred):**
- Qualquer código em `apps/web`, `apps/api` ou `packages/*`.
- Importar o handoff de design (`Pombo Design Foundation.dc.html` + `support.js`) — bloqueado nesta sessão (MCP sem `/design-login` interativo, navegadores sem sessão, fetch 403, sem cópia local). Vira a Fase 0 do roadmap.
- Task Specs das fases (cada uma nasce no seu próprio `/start-task` + `/triage`).

## 3. Acceptance criteria

- **AC-1** — O roadmap lista todas as fases necessárias para entregar a reconstrução, cada uma com escopo, tamanho/risco, especialista, dependências e critérios de aceite verificáveis.
- **AC-2** — O diagnóstico do `apps/web` é factual e rastreável (arquivos e linhas citados; contagens de páginas, módulos, testes, i18n).
- **AC-3** — O contrato com o backend usado pelo roadmap reflete as 37 rotas de negócio reais (+ 2 de health) e os "não existe" (SSE, paginação, histórico, CRUD de webhooks, token com escopos).
- **AC-4** — As decisões de arquitetura estão explícitas, com racional e alternativa rejeitada; as que dependem do usuário estão marcadas e consolidadas numa seção de perguntas.
- **AC-5** — O bloqueio do handoff está descrito com as três formas de destravar.

## 4. Contracts & interfaces

Nenhum. Documento apenas.

## 5. Reuse map (DRY first)

| Need | Existing piece | Path | Action |
|---|---|---|---|
| Formato de spec | template SDD | `.claude/patterns/spec.md` | seguir |
| Histórico de decisões do frontend | spec da migração v3 | `.claude/specs/refactor-chakra-v3-standardize-90cd98.md` | referenciar (deferidos viram fases) |
| Forma do pacote de theme | `@cuidda/theme` | `~/Documents/repositories/cuidda/packages/theme` | espelhar na Fase 3 |

## 6. Files plan

**Create:** `docs/web-rebuild/roadmap.md`, `.claude/specs/web-rebuild-roadmap-5b5abe.md`.
**Modify:** nenhum.

## 7. Test plan

Não se aplica (sem código). Verificação: revisão do documento contra os inventários (AC-1..AC-5) pelo `code-reviewer` na Fase 5 do `/finish-task`.

## 8. Diff budget

2 arquivos criados, 0 modificados, 0 dependências, 0 código.

## Decisions log

- [2026-09-16] Roadmap em `docs/web-rebuild/roadmap.md` (não em `.claude/specs/`): é um plano multi-PR, não o contrato de uma tarefa; cada fase terá sua própria spec. Handoff de design proposto para `docs/design/` (convenção já usada em `clintplay` e `clint-mobile`).
- [2026-09-16] O handoff não pôde ser lido nesta sessão; o roadmap foi entregue completo com a Fase 0 (intake) bloqueada e as Fases 1–2 independentes do design, em vez de esperar.
- [2026-09-16] Decisões D1–D11 tomadas com base no inventário; D1, D4 e D9 marcadas como abertas para o revisor do PR.
- [2026-09-16] `/code-review` (Fase 5 do `/finish-task`): 1 High corrigido — a contagem "34 rotas" estava errada (são 37 de negócio + 2 de health; o próprio Apêndice B somava 37) e foi corrigida em 3 lugares; 2 Medium (diagrama de dependências fazia a Fase 2 alimentar a Fase 3 em vez da 7; toaster light-only descrito como defeito quando é decisão documentada que a Fase 3 reverte) e 2 Low (contagens de `modules/`/`shared/`; frase de transição da §3) também corrigidos. Status → implemented.
- [2026-09-16] Pedido do usuário durante a Fase 4: os testes ficam para a última etapa. Das Fases 5–9 sai a escrita e a execução de testes; cada fase roda só `type-check` + `lint`, e a Fase 10 ganha o escopo e o AC-10.5 com os ACs de teste dessas fases (roadmap §4 Fase 10 e §7).
