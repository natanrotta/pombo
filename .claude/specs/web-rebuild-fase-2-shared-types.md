# Task Spec — web-rebuild-fase-2-shared-types

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (uma fase por commit) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Medium (toca `apps/api` e `apps/web`) |
| **Specialist** | /fullstack |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 2 (D6) |

## 1. Goal
Hoje o contrato HTTP de devices, mensagens e token é declarado duas vezes (API e web) e só a disciplina impede o drift; o próprio `@pombo/shared-types` já driftou (diz que o corpo de sign-in traz `refreshToken`, mas traz `csrfToken`). Ao fim desta fase o pacote é a única declaração do contrato consumido pelo web, a API tipa suas projeções com ele, e o `tsc` dos dois apps falha se o contrato e o código divergirem.

## 2. Scope
**In:**
- `packages/shared-types` ganha: envelope (`ApiSuccessResponse<T>`, `ApiErrorResponse`, `ValidationErrorDetails`); catálogo `ErrorCodes`/`ErrorCode` (movido da API); devices (`DEVICE_STATUSES`, `DeviceStatus`, `DeviceWebhooks`, `DeviceResponseDTO`, `RegisterDeviceRequestDTO`, `RegisterDeviceResponseDTO`, `UpdateDeviceWebhooksRequestDTO`, `DeviceQrResponseDTO`, `DeviceGroupDTO`, `DeviceConnectionResponseDTO`); mensagens (`MESSAGE_TYPES`, `MessageType`, `MESSAGE_STATUSES`, `MessageStatus`, os 6 request DTOs de envio, `SendMessageResponseDTO`, `MessageStatusResponseDTO`); token (`ApiTokenMetadataDTO`, `GenerateApiTokenResponseDTO`).
- Auth: os DTOs de resposta passam a descrever o corpo real (`{ user, token, csrfToken }`, sign-up com `csrfToken`, refresh `{ token, csrfToken }`); os resultados internos dos use cases (com `refreshToken`) viram tipos da API. `UserResponseDTO` (sem consumidor) sai.
- API: uniões de domínio (`DeviceStatus`, `MessageStatus`, `MessageType`), `DeviceWebhooks` e `GroupInfo` passam a reexportar o pacote; `toJSON`/`toMetadata` e os retornos de use case usam os DTOs; `shared/error/error-codes.ts` reexporta o catálogo; controller de auth e error handler tipam o corpo com o envelope.
- API: spec de contrato que falha se um enum do Prisma divergir da união do pacote (runtime + tipo) ou se um schema Zod de request divergir do DTO do pacote (tipo).
- Web: entidades de devices/mensagens/token viram aliases do pacote (tipos só de UI ficam: `SandboxMessageType`, `AuthUser` e inputs de auth); `HttpAuthRepository` usa os DTOs de auth; `core/errors/errorCodes.ts` sai e o web importa `ErrorCodes` do pacote; `httpClient` tipa o corpo de erro com `ApiErrorResponse`.

**Out (deferred):**
- DTOs de request de auth/perfil e da API pública (`/api/v1`) — o web não os consome como contrato hoje.
- Envelope tipado em todos os controllers da API (só auth + error handler nesta fase).
- Converter o pacote para ESM.

## 3. Acceptance criteria
- **AC-1** — `grep -rn "@pombo/shared-types" apps/web/src` mostra importações reais em devices, messaging, account, auth e core.
- **AC-2** — Nenhum tipo de resposta de device/mensagem/token e nenhuma união de status/tipo é declarado com campos em mais de um lugar do monorepo (API e web só reexportam/aliasam).
- **AC-3** — Os specs de contrato da API falham se `device_status`, `message_status` ou `outbox_message_type` do Prisma divergir de `DEVICE_STATUSES`/`MESSAGE_STATUSES`/`MESSAGE_TYPES`, e o `type-check` falha se um schema Zod de request divergir do DTO do pacote.
- **AC-4** — Os tipos de resposta de auth do pacote batem com o corpo real dos controllers (checado por `satisfies` no controller).
- **AC-5** — Adicionar um `ErrorCode` sem as 3 locales continua falhando o `error-codes.spec.ts` (agora sobre o catálogo do pacote).
- **AC-6** — Zero mudança de comportamento: `type-check`, `lint`, `test` (api + web), `build:web` e e2e verdes; nenhum corpo HTTP muda.

## 4. Contracts & interfaces
Nenhum endpoint muda. Os DTOs acima são a descrição tipada dos corpos que já existem (Apêndice B do roadmap). Datas são strings ISO-8601.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Pacote de workspace lido como código-fonte pelo Vite | `@cuidda/theme` (`main: ./src/index.ts`) | `~/Documents/repositories/cuidda/packages/theme` | espelhar via alias só no web (a API continua no `dist` CJS) |
| Paridade de locales dos códigos | `error-codes.spec.ts` | `apps/api/src/shared/error/` | manter, agora sobre o reexport |
| Lista de status para regra de transição | `MESSAGE_STATUSES` | `apps/api/.../message-status.ts` | mover para o pacote e reexportar |

## 6. Files plan
**Create:** `packages/shared-types/src/{api,error-codes,devices,messaging,account}.ts`, `apps/api/src/modules/devices/domain/value-object/device-status.spec.ts`, `apps/api/src/modules/messaging/domain/value-object/message-type.spec.ts`, esta spec.
**Delete:** `packages/shared-types/src/user.ts`, `apps/web/src/core/errors/errorCodes.ts`.
**Modify:** `packages/shared-types/src/{index,auth}.ts`; web — `aliases.ts`, `vite.config.ts`, `tsconfig.json`, `e2e/global.setup.ts`; API — `shared/error/{error-codes,app-error}.ts`, `shared/provider/domain-event-bus.interface.ts`, specs `device.dto.spec.ts`, `message.dto.spec.ts`, `message-status.spec.ts`, `core/http/middlewares/error-handler.middleware.ts`, devices (`device-status.ts`, `device.entity.ts`, `whatsapp-gateway.interface.ts`, `device.dto.ts`, use cases list/get/update-webhooks/connect/disconnect/get-qr/list-groups/register + `index.ts`), messaging (`message-status.ts`, `message-type.ts`, `outbox-message.entity.ts`, use cases send-text/send-rich/get-status), account (`api-token.entity.ts`, use cases get-metadata/generate), auth (`auth.dto.ts`, use cases sign-in/sign-up/google/refresh/verify-email-pin, `auth.controller.ts`); web — entidades `Device.ts`, `Message.ts`, `ApiToken.ts`, `HttpAuthRepository.ts`, `AppError.ts`, `httpClient.ts`, `useNotify.ts` (+spec); docs `README.md` (raiz), `patterns/{backend,backend-modules,frontend,code-review-checklist}.md` (`F-H13` passa a exigir alias do DTO), `knowledge/{fullstack,frontend}.md`.

## 7. Test plan
AC-3 → `device-status.spec.ts`, `message-status.spec.ts`, `message-type.spec.ts` (runtime + `expectTypeOf` contra o enum do Prisma) e `device.dto.spec.ts` / `message.dto.spec.ts` (`expectTypeOf` de `z.input<schema>` contra o DTO); as asserções de tipo são checadas pelo `yarn type-check`, que inclui specs — provado com uma sonda negativa temporária que quebrou o build duas vezes. AC-4 → `satisfies` no controller (type-check). AC-5 → `error-codes.spec.ts` existente. AC-1/AC-2 → grep na revisão. AC-6 → gates.

## 8. Diff budget
~7 arquivos criados, 2 deletados, ~40 modificados (maioria troca de import). Zero dependência nova. Zero mudança de corpo HTTP.

## Decisions log
- [2026-09-16] O domínio da API passa a depender do pacote para as uniões e `DeviceWebhooks` (import só de tipo, pacote sem dependências): o pacote é o shared kernel do contrato. Manter uniões próprias + asserção de igualdade deixaria duas declarações, exatamente o que a fase remove.
- [2026-09-16] No web, os arquivos de entidade continuam existindo como aliases do pacote: preserva a estrutura `domain/entities` e evita reescrever os imports de todas as telas.
- [2026-09-16] O web passa a enxergar o catálogo completo de `ErrorCodes` (a regra "só os códigos em que a UI ramifica" deixa de fazer sentido com um catálogo único e tipado).
- [2026-09-16] O pin de contrato fica **co-localizado nos módulos** (value objects e specs de DTO), não num `shared/contract/`: `patterns/backend-modules.md` proíbe conhecimento de domínio em `shared/`. As asserções usam `expectTypeOf` do Vitest (sem helper novo).
- [2026-09-16] `AppError.toJSON()` passou a retornar `ApiErrorBody` (antes `Record<string, unknown>`) para o `satisfies ApiErrorResponse` do error handler ter efeito; e `DomainMessageStatus` do barramento de eventos (uma terceira cópia da união) virou alias do pacote.
- [2026-09-16] Comentários de três códigos de erro foram corrigidos na mudança para o pacote (`DEVICE_NAME_TAKEN` citava um `@unique` global que hoje é por conta; `DEVICE_OFFLINE` dizia que envio offline não enfileira; `AUTH_EMAIL_ALREADY_VERIFIED` citava onboarding).
- [2026-09-16] Este commit também leva duas lições da Fase 1 para `knowledge/frontend.md` (renomear chave de storage; verificação visual pelo app desktop), que ficaram de fora do commit daquela fase.
- [2026-09-16] **O e2e pegou um defeito que unit, type-check e `vite build` não viram:** o Vite pré-empacotava o `@pombo/shared-types` (`optimizeDeps.include`) e não reotimiza pacote linkado quando só o `dist` muda — o bundle velho não tinha `ErrorCodes` e o app abria em branco. Correção: o web passa a ler o pacote do código-fonte TS (alias + `tsconfig` paths), os dois special-cases de CJS saem do `vite.config.ts` e a lista de reexport explícito do `index.ts` sai do pacote. O `global.setup.ts` passa a checar o `h1` de `/devices`, porque o teste de URL passava com o app em branco.
- [2026-09-16] Babysit nível 1: auditor 0 Critical/High; Medium (comentários citando um `shared/contract/wire-contract.spec.ts` inexistente) e Low (posição do import no port do gateway) corrigidos.
- [2026-09-16] Babysit nível 2: revisor 0 Critical/High; o Medium (a regra de dependência não mencionava a exceção de import de tipo do pacote no domínio) foi documentado em `backend.md` e `backend-modules.md`. Observação registrada para o PR: quem sobe a API por fora dos scripts da raiz (`yarn workspace @pombo/api dev`) precisa de `yarn shared:build` depois de editar o pacote.
- [2026-09-16] Babysit nível 3 (`/duck-debug`): **CLEAN**. As 6 perguntas foram resolvidas com evidência (sem import órfão; colapso do DTO do Google sem perda; `emailVerified`/`language` são NOT NULL e sempre emitidos, então os defaults removidos eram mortos; nenhuma subclasse de `AppError` sobrescreve `toJSON`). A observação não bloqueante (armadilha do `dist` desatualizado) virou uma nota no README raiz.
