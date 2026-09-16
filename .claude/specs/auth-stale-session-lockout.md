# Task Spec — auth-stale-session-lockout

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (commit próprio, dentro da Fase 10) |
| **Date** | 2026-09-16 |
| **Size / Risk** | S / High (CSRF + sessão) |
| **Specialist** | /fullstack |
| **Origin** | Usuário não conseguia entrar (e-mail/senha nem Google) no ambiente local |

## 1. Goal
Um cookie de sessão sobrando não pode travar o login, e a sessão expirada (JWT de 15 min) deve se renovar sozinha enquanto o refresh token for válido.

## 2. Diagnóstico (reproduzido com `curl` na API local)
- `POST /api/auth/sign-in` com `pombo_at` e sem `pombo_csrf` → **403** (o `csrfProtection` trata o `pombo_at` como sessão e exige o double-submit). Vale para sign-up, Google e senha: o usuário fica sem saída até limpar os cookies.
- A renovação silenciosa do `httpClient` usa `axios.post` cru, **sem** `X-CSRF-Token`: com `pombo_at` presente, `POST /api/auth/refresh` → **403** sempre. A sessão nunca renova; a cada 15 min o usuário cai no login.
- A sondagem de boot (`GET /auth/me` com `skipSessionExpiredRedirect`) trata `AUTH_TOKEN_EXPIRED` como "deslogado" sem tentar o refresh.
- Um refresh que falha não limpa os cookies: a sessão morta fica no navegador.

## 3. Scope
**In:**
- API `csrfProtection`: nos endpoints públicos que emitem credencial (`/api/auth/sign-up`, `/sign-in`, `/google`, `/password/request-reset`, `/password/reset`), sem cookie CSRF e sem `Authorization`, um `pombo_at` sobrando não exige double-submit. Com o cookie CSRF presente, a checagem continua como hoje.
- API `refresh`: se a renovação falha (sem refresh token ou token inválido/expirado/revogado) e o pedido trouxe algum cookie de auth, limpa os cookies antes de responder o erro.
- Web `httpClient`: o refresh silencioso envia `X-CSRF-Token`.
- Web `HttpAuthRepository.getCurrentUser`: com `AUTH_TOKEN_EXPIRED`, tenta um refresh e repete o `/auth/me` uma vez; qualquer outra falha continua "deslogado".

**Out:** `/auth/refresh` continua exigindo double-submit (não amplia a exceção); nenhuma mudança de cookie, TTL ou SameSite.

## 4. Acceptance criteria
- **AC-1** — Com `pombo_at` e sem `pombo_csrf`, sign-in/sign-up/Google/senha chegam ao caso de uso (não 403). Com `pombo_csrf` presente e header ausente/errado, continuam 403.
- **AC-2** — Rotas autenticadas e `/auth/refresh` mantêm a exigência atual.
- **AC-3** — Um refresh que falha responde o erro e limpa `pombo_at`, `pombo_rt` e `pombo_csrf` quando o pedido trouxe algum deles; um pedido sem cookie (POST forjado de outro site) não limpa nada.
- **AC-4** — O refresh silencioso do cliente envia `X-CSRF-Token` quando o cookie existe.
- **AC-5** — Abrir o app com o JWT expirado e refresh válido restaura a sessão sem passar pelo login; com refresh inválido, o usuário vê o login e consegue entrar.
- **AC-6** — Testes: `csrf.middleware.spec.ts`, `auth.controller.spec.ts` (refresh), spec do `HttpAuthRepository` e do refresh do `httpClient`; gates verdes; revisão de segurança sem Critical/High.

## 5. Files plan
**Modify:** `apps/api/src/core/http/middlewares/csrf.middleware.ts` (+spec), `apps/api/src/modules/auth/infrastructure/controller/auth.controller.ts` (+spec), `apps/web/src/core/http/httpClient.ts`, `apps/web/src/modules/auth/infrastructure/repositories/HttpAuthRepository.ts`.
**Create:** `apps/web/src/modules/auth/infrastructure/repositories/HttpAuthRepository.spec.ts`, `apps/web/src/core/http/httpClient.spec.ts`, esta spec.

## Decisions log
- [2026-09-16] Usuário escolheu corrigir API + web. Exposição do login a CSRF igual à de um navegador sem cookies (caso já permitido); `pombo_at` é SameSite (lax em dev, strict em prod).
- [2026-09-16] Revisão de código: 0 Critical/High; Medium registrado como pendência — o refresh do boot (`HttpAuthRepository`) e o do interceptor não compartilham a mesma tentativa em andamento; hoje é inalcançável (as rotas só buscam dados depois do boot), vira risco se algo autenticado for montado fora dos guards.
- [2026-09-16] Auditoria de segurança: High corrigido — limpar os cookies sem nenhum cookie no pedido permitia deslogar qualquer usuário com um `<form>` POST de outro site (o SameSite tira os cookies do pedido, mas o navegador aplica o `Set-Cookie` da resposta numa navegação de topo). Agora só limpa quando o pedido trouxe `pombo_at`, `pombo_rt` ou `pombo_csrf`; dois testes novos, com prova negativa. Low aceito: o match exato de `req.path` falha fechado (volta a exigir o double-submit).
