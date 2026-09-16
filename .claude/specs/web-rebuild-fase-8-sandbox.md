# Task Spec — web-rebuild-fase-8-sandbox

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (uma fase por commit) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Medium |
| **Specialist** | /frontend |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 8 — **parte estrutural** |

## 1. Goal
Quebrar o `SandboxPage` (453 linhas) em peças de uma responsabilidade cada e dar estado próprio aos casos que hoje viram só um toast genérico: device offline ao listar grupos, número fora do WhatsApp e mensagem presa em `PENDING` pelo ritmo humanizado. O visual atual é mantido.

## 2. Scope
**In:**
- `presentation/utils/sandboxForm.ts` (puro): tipo do formulário, `MAX_BURST` (20), tipos de mensagem, campos por tipo vazios, `clampCount`, `isMediaType`, validadores, `buildSendArgs(form, index, total)`.
- `presentation/hooks/useSandboxComposer.ts`: estado do formulário, escolha do device conectado (sem `eslint-disable`), troca de tipo e limpeza, rajada sequencial que para na primeira falha, recentes, fila em memória.
- Componentes: `SandboxComposer` (card de composição), `GroupRecipientField` (seleção de grupo com carregando/vazio/offline/erro) e `SandboxMessageFields` (texto e mídia por tipo). `SandboxPage` fica com cabeçalho, carregando, vazio (CTA para `/devices`) e a grade.
- `DEVICE_OFFLINE` ao listar grupos: mensagem própria no seletor.
- `NUMBER_NOT_ON_WHATSAPP`: o campo de número fica marcado com a mensagem própria (o toast do hook continua).
- Linha da fila em `PENDING` por mais de ~15 s (medido no cliente, do primeiro render ao último poll): explicação do ritmo humanizado.
- Sem `colorPalette` inerte no botão de enviar.

**Out (deferred):**
- `IDEMPOTENCY_KEY_CONFLICT`: continua só no toast localizado da API — cada envio gera uma chave nova, então o conflito não é um caminho de uso.
- Testes: specs de `useSendMessage`/`useRecentRecipients` e e2e do envio (AC-8.1/8.2) → Fase 10 (AC-10.5).
- Visual conforme o design (Fase 0 bloqueada).

**Contratos intocados:** um `Idempotency-Key` novo por envio; mídia como string (URL ou base64); poll de status a cada 2 s até `READ`/`FAILED` com `gcTime: 0`; recentes no `localStorage`; sufixo `(i/N)` em rajadas de texto/grupo; envio para grupo não entra nas recentes; API pública do barrel.

## 3. Acceptance criteria
- **AC-1** — Nenhum arquivo do módulo passa de ~200 linhas; `SandboxPage` só orquestra; nenhum `eslint-disable` no módulo.
- **AC-2** — Com o device offline, o seletor de grupos diz isso (não o erro genérico).
- **AC-3** — Um envio recusado por número fora do WhatsApp marca o campo de número com a mensagem própria; editar o número limpa a marca.
- **AC-4** — Uma linha em `PENDING` há mais de ~15 s mostra a explicação do ritmo; ela some quando o status avança.
- **AC-5** — Comportamento do envio igual ao de hoje (validação, rajada, sufixo, parada na primeira falha, recentes, limpar, troca de tipo).
- **AC-6** — i18n nas 3 locales; `type-check`, `lint`, `build:web` verdes.

## 4. Contracts & interfaces
Sem mudança de API. `useSandboxComposer()` devolve o formulário, as opções, os handlers (`handleTypeChange`, `handleSend`, `handleReset`), `isSending`, `sends` e as recentes. i18n novas em `sandbox.json`: `fields.groupOffline`, `errors.phoneNotOnWhatsApp`, `queue.pacingPending`.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Estado do formulário | `useFormState` (`setError`) | `shared/hooks/useFormState.ts` | consumir |
| Grupos | `useDeviceGroups` | barrel `@/modules/devices` | consumir |
| Campos | `SelectField`, `FormField`, `TextAreaField`, `NumberField` | `shared/components/forms/` | consumir |
| Erro tipado | `AppError` + `ErrorCodes` | `core/errors`, `@pombo/shared-types` | consumir |

## 6. Files plan
**Create:** `modules/messaging/presentation/utils/sandboxForm.ts`, `modules/messaging/presentation/hooks/useSandboxComposer.ts`, `modules/messaging/presentation/components/{SandboxComposer,GroupRecipientField,SandboxMessageFields}.tsx`, esta spec.
**Modify:** `modules/messaging/presentation/pages/SandboxPage.tsx`, `modules/messaging/presentation/components/SandboxQueueItem.tsx`, `shared/i18n/locales/{pt-BR,en,es}/sandbox.json`.

## 7. Test plan
Por decisão do usuário (roadmap §7), nada de teste escrito ou executado nesta fase. Gates: `type-check`, `lint`, `build:web`. AC-8.1/8.2 → Fase 10.

## 8. Diff budget
5 arquivos criados (+ esta spec), ~5 modificados. Nenhuma dependência nova.

## Decisions log
- [2026-09-16] Parte estrutural só; testes adiados (pedido do usuário); `/duck-debug` não é obrigatório na Fase 8 (roadmap §7).
- [2026-09-16] Os validadores viram constante de módulo em `sandboxForm.ts`: passados inline ao `useFormState`, recriavam `setField`/`validate` a cada render.
- [2026-09-16] Babysit: auditor 0 Critical/High; Medium aplicado (o `handleTypeChange` depende só de `deviceId`/`phone`/`count`, não do objeto do formulário); Lows aplicados (`SandboxQueueItem` com `memo`, `MediaMessageType` e `EMPTY_TYPE_FIELDS` sem `export`). Revisor 0 Critical/High/Medium; Low registrado para depois: o efeito do device roda a cada tecla porque o `setField` do `useFormState` muda de identidade a cada alteração — no-op protegido, a correção é no hook compartilhado.
- [2026-09-16] O seletor de grupos agora só monta com o tipo "grupo" (antes a query era desligada por `enabled`): mesmo efeito na rede, fronteira de montagem mais clara.
- [2026-09-16] `/code-review` final: 0 Critical/High/Medium; Low aplicado (a marca de número fora do WhatsApp só vale para envios com telefone). Gates: `type-check`, `lint`, `build:web` verdes; testes não rodados (decisão do usuário).
