# Task Spec — web-rebuild-fase-6-auth

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (uma fase por commit) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / High (superfície de auth — `/duck-debug` obrigatório) |
| **Specialist** | /frontend (+ 1 linha de CORS na API, exceção documentada) |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 6 — **parte estrutural** |

## 1. Goal
As 5 telas de autenticação passam a ser montadas com peças compartilhadas (layouts, card, divisor, controles), com formulários validados por RHF + Zod, cores semânticas e os caminhos de erro que hoje somem (429 no login, e-mail já confirmado). O visual atual é mantido.

## 2. Scope
**In:**
- `modules/auth/presentation/components/`: `AuthSplitLayout` (brilhos decorativos + painel hero + marca no mobile + controles; login e cadastro), `AuthCenteredLayout` (esqueci, redefinir, confirmar e-mail), `AuthCard` (título, subtítulo, eyebrow opcional, direção de entrada), `AuthDivider` ("ou") e `AuthControls` (`ColorModeToggle` + `LanguageSelector`, iguais em todas as telas de auth).
- Esqueci/redefinir senha em RHF + Zod com `buildForgotPasswordSchema`/`buildResetPasswordSchema` em `domain/schemas.ts` (regra de força e confirmação iguais; mesmas mensagens i18n).
- Tokens semânticos no lugar da paleta crua (`brand.50/100/600/700`): banner de envio → o destaque esmeralda do tema (`bg.accent.subtle` + `text.brand` + `border.accent`); links → `text.brand`.
- `resolveSignInRedirect` sai do meio dos imports do `SignInPage` para `presentation/utils/postAuthDestination.ts`.
- 429: o login e o "esqueci a senha" mostram a mensagem da API quando o limite estoura (os demais erros mantêm a mensagem genérica); o `useNotify.showError` acrescenta "tente novamente em N" quando o `AppError` traz `retryAfter`. A API expõe `Retry-After` no CORS (`exposedHeaders`), senão o navegador esconde o cabeçalho em produção (origem cruzada).
- Confirmação de e-mail: `ErrorCodes` no lugar do texto literal; `AUTH_EMAIL_ALREADY_VERIFIED` no envio/reenvio descarta o token de verificação e leva ao login com um toast informativo.
- Rotas públicas dentro de um layout de rota com `RouteErrorBoundary` (hoje só o `GlobalErrorBoundary` as cobre).

**Out (deferred):**
- Redesenho das telas (Fase 0 bloqueada).
- Testes: e2e de cadastro→PIN, esqueci→redefinir e login negativo (AC-6.1/AC-6.2) → Fase 10 (AC-10.5).
- Dividir o formulário do login/cadastro em componente próprio: com o layout extraído, cada página fica com a lógica e o formulário (<200 linhas).

**Contratos intocados:** `/reset-password?token=`, `/verify-email` com token escopado no `sessionStorage`, `PublicOnlyRoute`/`getPostAuthDestination`, `GoogleSignInButton` (`data-cy="google-signin"`), espelho do cooldown de 60 s, slide direcional via `location.state.from`, rótulos/papéis usados pelo `e2e/tests/auth.spec.ts`.

## 3. Acceptance criteria
- **AC-1** — As 5 páginas usam os layouts/card/divisor/controles compartilhados; `SignInPage` e `RegisterPage` abaixo de 200 linhas; visual igual ao atual (exceto: cadastro, esqueci, redefinir e confirmar ganham o botão de tema que só o login tinha; eyebrow e links em `text.brand`).
- **AC-2** — Esqueci/redefinir validam por Zod (RHF); mensagens e regras iguais; esqueci também rejeita e-mail malformado (antes a validação nativa do navegador fazia isso).
- **AC-3** — Nenhum token de paleta crua (`brand.NN`) nas telas de auth; nenhum hex/rgba (AC-3.2 mantido).
- **AC-4** — 429 no login ou no "esqueci" mostra a mensagem localizada da API com o tempo de espera quando o cabeçalho existe; a API expõe `Retry-After`.
- **AC-5** — E-mail já confirmado durante a confirmação leva ao login com aviso, sem toast de erro; nenhum código de erro como texto literal.
- **AC-6** — Um erro de render numa rota pública cai no `RouteErrorBoundary`.
- **AC-7** — Contratos da seção 2 intocados; i18n nas 3 locales; `type-check`, `lint` e `build:web` verdes; `/duck-debug` CLEAN.

## 4. Contracts & interfaces
HTTP: nenhum endpoint muda; a resposta passa a expor o cabeçalho `Retry-After` no CORS. Props: `AuthSplitLayout { children }`, `AuthCenteredLayout { children }`, `AuthCard { variant: "split" | "centered", title, subtitle, enterFrom? }`, `AuthDivider { label }`. i18n novas: `auth.verifyEmail.alreadyVerified`, `common.notify.retryIn`.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Validação de formulário | `buildSignInSchema` / `buildRegisterSchema` | `modules/auth/domain/schemas.ts` | estender |
| Campos | `FormField`, `PasswordField`, `PasswordStrengthIndicator` | `shared/components/forms/` | consumir |
| Toasts | `useNotify` | `shared/hooks/useNotify.ts` | estender (`retryAfter`) |
| Fronteira de erro | `RouteErrorBoundary` | `shared/components/ui/` | consumir |
| Transições | `TRANSITION_SLOW`, `TRANSITION_PAGE_SWAP` | `shared/constants/animation.ts` | consumir |

## 6. Files plan
**Create:** `modules/auth/presentation/components/{AuthSplitLayout,AuthCenteredLayout,AuthCard,AuthDivider,AuthControls}.tsx`, esta spec.
**Modify:** `modules/auth/presentation/pages/{SignIn,Register,ForgotPassword,ResetPassword,EmailVerification}Page.tsx`, `modules/auth/domain/schemas.ts`, `modules/auth/presentation/utils/postAuthDestination.ts`, `shared/hooks/useNotify.ts`, `core/errors/AppError.ts` (`isRateLimitError`), `shared/components/ui/RouteErrorBoundary.tsx` (comentário), `app/router/AppRouter.tsx`, `shared/i18n/locales/{pt-BR,en,es}/{auth,common}.json`, `apps/api/src/core/http/app.ts`.

## 7. Test plan
Por decisão do usuário (roadmap §7), nada de teste escrito ou executado nesta fase. Gates: `type-check`, `lint`, `build:web`; babysit até `/duck-debug`. AC-6.1/AC-6.2 → Fase 10.

## 8. Diff budget
~6 arquivos criados, ~14 modificados (1 na API). Nenhuma dependência nova.

## Decisions log
- [2026-09-16] Parte estrutural só: o handoff continua inacessível. Testes adiados (pedido do usuário).
- [2026-09-16] O "tente novamente em N" entra no `useNotify.showError` (todo 429 do app ganha o tempo), não numa função só do auth: cadastro e redefinir já repassam o erro para o `showError`.
- [2026-09-16] A linha de CORS na API é exceção de camada consciente: sem `exposedHeaders`, o `Retry-After` não chega ao JS numa origem cruzada, e o AC-4 seria falso em produção.
- [2026-09-16] `AuthCard` tem `variant` (`split`/`centered`) para manter as duas aparências de hoje (sombra, espaçamentos, eyebrow); a unificação é decisão do design.
- [2026-09-16] Babysit: auditor 0 Critical/High/Medium (1 Low: `motion.create(Box)` sem re-tipagem — espelha o código anterior, sem colisão de `style`); revisor 0 Critical/High/Medium, 3 Low aplicados (plano de arquivos completo, `else if` entre 429 e validação no `useNotify`, `id` nos brilhos como chave). Observação do revisor para a Fase 10: o `/security` deve olhar a chave dos limitadores (IP × e-mail) agora que o tempo de espera aparece; o 429 não vaza existência de conta (mesma mensagem para qualquer e-mail).
- [2026-09-16] `/duck-debug` rodada 2: o banner de "link enviado" tinha ido para `status.success.*`, que usa o verde padrão do Chakra (outro tom) — mudança visual não declarada. Trocado pelo par de destaque esmeralda que o tema já tem: fundo e texto voltam idênticos (`brand.50`/`brand.700`); a borda passa de `brand.100` para `accent.300` (mesma escala, um tom mais forte), a única diferença, aceita por não existir token semântico para o 100.
- [2026-09-16] Descoberto no `/duck-debug`: o `verify-email-pin` da API é idempotente para um usuário já confirmado (emite a sessão sem checar o PIN), então só o envio/reenvio precisa tratar `AUTH_EMAIL_ALREADY_VERIFIED` — o que a página faz.
- [2026-09-16] `/code-review` final: 0 Critical/High. Medium aplicado — o botão do Google (login e cadastro) passa pelo mesmo limitador e agora também mostra o 429. Low aplicado — o sufixo de espera não duplica pontuação (`!`/`?`). Low registrado — as três telas centralizadas passam a entrar com o `TRANSITION_SLOW` (mesma duração de 0,3 s, curva `EASE_ORGANIC` no lugar de `easeOut`), diferença de easing aceita ao unificar o card.
- [2026-09-16] Gates: `type-check`, `lint` e `build:web` verdes na raiz; testes não rodados (decisão do usuário).
