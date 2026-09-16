# Task Spec — web-rebuild-fase-9-profile-api

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (uma fase por commit) |
| **Date** | 2026-09-16 |
| **Size / Risk** | S / Low |
| **Specialist** | /frontend (+ constantes de upload em `packages/shared-types` usadas pela API) |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 9 — **parte estrutural** |

## 1. Goal
Deixar as telas de Perfil e API em peças menores, com um seletor de avatar acessível que valida tamanho e tipo antes de enviar, e um texto de rotação do token que diz a verdade sobre a revogação. O visual atual é mantido.

## 2. Scope
**In:**
- `ApiTokenTab` dividido em `ApiTokenSummaryCard` (metadados + "gerar novo"), `ApiUsageCard` (exemplo de uso + download da collection Postman) e `ApiTokenRevealModal` (revelação única); o `ApiTokenTab` compõe e fica com a geração e a confirmação (`mutateAsync`).
- Texto da confirmação de rotação (3 locales): o token anterior é revogado e pode levar até 60 s para parar de funcionar (cache de autenticação da API).
- `ProfileAvatarCard` sai do `ProfileTab`: seletor de avatar como `button` real (foco, Enter/Espaço, sobreposição visível também no foco), validação de 5 MB e da lista de tipos antes do envio com mensagens localizadas, `accept` derivado da lista.
- `packages/shared-types/src/uploads.ts`: `ALLOWED_IMAGE_MIME_TYPES` + `MAX_IMAGE_UPLOAD_BYTES`; a API passa a usá-los (`image-upload.ts` reexporta a lista; `upload.middleware.ts` usa o limite).
- Tokens semânticos na sobreposição (`bg.overlay`) e no avatar (`text.onBrand`); sem `colorPalette` inerte nos botões dos dois módulos.

**Out (deferred):**
- Testes: spec de `useApiToken`, e2e de token e perfil, snapshots (AC-9.1–9.3) → Fase 10 (AC-10.5). O `ProfileTab.spec.tsx` existente deve continuar compatível.
- Visual conforme o design (Fase 0 bloqueada).

**Contratos intocados:** `/settings` → `/perfil`; token revelado uma vez; download da collection; prefixo/criação/último uso; autosave de nome/e-mail (1500 ms) + guarda de alterações; idioma e tema no cabeçalho do perfil; barrels dos módulos; comportamento do upload na API (mesma lista, mesmo limite, mesmos erros).

## 3. Acceptance criteria
- **AC-1** — `ApiTokenTab` e `ProfileTab` abaixo de ~150 linhas cada, com as peças novas; comportamento igual.
- **AC-2** — O diálogo de rotação diz que o token anterior é revogado e que isso pode levar até 60 s, nas 3 locales.
- **AC-3** — O avatar é alcançável por Tab e abre o seletor com Enter/Espaço; a sobreposição aparece no hover e no foco.
- **AC-4** — Arquivo acima de 5 MB ou fora da lista não é enviado e mostra uma mensagem própria; o seletor só oferece os tipos da lista.
- **AC-5** — A lista de tipos e o limite existem uma vez só (`@pombo/shared-types`) e a API os usa.
- **AC-6** — Nenhum `colorPalette` em `Button` de `modules/account`/`modules/settings`; nenhuma cor crua da paleta no card de avatar.
- **AC-7** — i18n nas 3 locales; `type-check` (web + api + shared-types), `lint`, `build:web` verdes.

## 4. Contracts & interfaces
Sem mudança de endpoint. `@pombo/shared-types` ganha `ALLOWED_IMAGE_MIME_TYPES`, `AllowedImageMimeType`, `MAX_IMAGE_UPLOAD_BYTES`. i18n novas em `settings.json`: `profile.avatarTooLarge`, `profile.avatarInvalidType`.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Lista de MIME | `ALLOWED_IMAGE_MIME_TYPES` | `apps/api/src/shared/constant/image-upload.ts` | mover para `shared-types` |
| Erros e toasts | `useErrorHandler`, `useNotify` | `core/query`, `shared/hooks` | consumir |
| Cards/modais | `SectionCard`, `AppModal`, `ConfirmDialog`, `CopyButton`, `InfoRow` | `shared/components/ui` | consumir |

## 6. Files plan
**Create:** `packages/shared-types/src/uploads.ts`; `modules/account/presentation/components/{ApiTokenSummaryCard,ApiUsageCard,ApiTokenRevealModal}.tsx`; `modules/settings/presentation/components/ProfileAvatarCard.tsx`; esta spec.
**Modify:** `packages/shared-types/src/index.ts`; `apps/api/src/shared/constant/image-upload.ts`; `apps/api/src/core/http/middlewares/upload.middleware.ts`; `apps/api/src/core/config/schema/cache.schema.ts` (comentário); `shared/components/layout/{SidebarUserMenu,MobileHeader}.tsx` (cor do avatar); `modules/account/presentation/components/ApiTokenTab.tsx`; `modules/settings/presentation/components/ProfileTab.tsx`; `shared/i18n/locales/{pt-BR,en,es}/settings.json`; docs: `docs/web-rebuild/roadmap.md` (pendências herdadas na Fase 10), `.claude/knowledge/frontend.md` (lição do `group`).

## 7. Test plan
Por decisão do usuário (roadmap §7), nada de teste escrito ou executado nesta fase. Gates: `type-check`, `lint`, `build:web`. AC-9.1–9.3 → Fase 10.

## 8. Diff budget
5 arquivos criados (+ esta spec), ~8 modificados. Nenhuma dependência nova.

## Decisions log
- [2026-09-16] Parte estrutural só; testes adiados (pedido do usuário); `/duck-debug` não é obrigatório na Fase 9 (roadmap §7).
- [2026-09-16] Limite e lista de tipos no `shared-types` (e não duplicados no web): é o núcleo compartilhado de constantes de runtime desde a Fase 2, e a API já consome o `dist` dele.
- [2026-09-16] A sobreposição do avatar fica visível durante o envio (antes só no hover, então o spinner quase nunca aparecia).
- [2026-09-16] Achado fora do escopo, para a Fase 10: no Chakra v3 `_groupHover` exige a classe `group` no pai (`.group:is(:hover…) &`), não `role="group"`. O `EntityCard` usa `role="group"`, então as `quickActions` nunca apareceriam no hover (md+) — defeito adormecido, sem consumidor hoje. O `.claude/commands/frontend.md` (UX default 10) ainda recomenda `role="group"`; corrigir os dois juntos e portar para o `cuidda`.
- [2026-09-16] Auditor: 0 Critical/High; Medium aplicado (plano de arquivos com os dois docs). Low mantido: o ícone/spinner sobre a sobreposição fica `white` — `bg.overlay` é escuro nos dois modos, e nenhum token de texto atual serve ali (`text.onBrand` inverte no escuro); um `text.onOverlay` fica para o design.
- [2026-09-16] Revisor: 1 High corrigido — o avatar ainda usava a cor crua `brand.500` (AC-6). Os três avatares (perfil, sidebar, header mobile) passam a usar o par do botão principal, `bg.brand.solid` + `text.onBrand`: no claro o fundo vai de `brand.500` para `brand.600` (branco sobre o 500 tinha ~2,5:1; sobre o 600 fica 3,8:1 — melhora, mas as iniciais pequenas ainda não chegam ao AA de 4,5:1, pendência da Fase 10); no escuro fica igual. Mediums aplicados: o schema do cache da API aponta para o texto da web que cita os 60 s, e o comentário do upload não repete mais "5 MB".
- [2026-09-16] Revisor (iteração 2): High resolvido; Medium registrado na Fase 10 (contraste AA das iniciais do avatar no modo claro).
- [2026-09-16] `/code-review` final: 0 Critical/High; Medium aplicado (`uploads.ts` aponta para as mensagens que citam os limites). Observação herdada (preview do avatar não limpo após sucesso) listada nas pendências da Fase 10. Gates verdes: `type-check`, `lint`, `build:web`.
