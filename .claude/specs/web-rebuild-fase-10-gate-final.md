# Task Spec — web-rebuild-fase-10-gate-final

| | |
|---|---|
| **Status** | approved |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (sub-commits 10a–10d) |
| **Date** | 2026-09-16 |
| **Size / Risk** | L / Medium |
| **Specialist** | /frontend + /devops (CI) |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 10 (inclui AC-10.5 e as pendências herdadas) |

## 1. Goal
Fechar a reconstrução estrutural: cobrir com testes o que as Fases 5–9 entregaram, levar build e e2e da web para o CI, resolver as pendências herdadas e alinhar a documentação com o código.

## 2. Scope
**In — 10a (testes unitários):** hooks de `devices` (otimismo com `restoreDevice`, prefetch, refresh, QR), `useSendMessage`/`useRecentRecipients`/`sandboxForm`, `useApiToken`, validação do `ProfileAvatarCard`, sufixo de espera do `useNotify`, `resolveSignInRedirect`, e-mail já confirmado no `EmailVerificationPage`, esquemas de esqueci/redefinir.

**In — 10b (e2e + visual):** page objects em `e2e/pages/`, `fixtures/test-data.ts` e helpers do `api-client`; specs `shell/navigation`, `auth/{sign-in-negative,forgot-reset,register-verify}`, `devices/{device-crud,device-connect}`, `messaging/sandbox-send` (envio interceptado por `route()`), `account/api-token`, `settings/profile`; snapshots claro/escuro do shell, de devices e do perfil; baselines da galeria regenerados (variante `dangerOutline`).

**In — 10c (CI):** `yarn build:web` e um job Playwright (serviços `postgres:15` + `redis:7`, `WHATSAPP_ENABLED=false`, report como artifact).

**In — 10d (pendências + docs):** `EntityCard` com `className="group"` + correção no `.claude/commands/frontend.md`; `colorPalette`/cores cruas restantes nos componentes compartilhados; preview do avatar limpo após sucesso; `signal` do TanStack Query até o `httpClient`; `useFormState.setField` estável; contraste AA das iniciais do avatar; varredura de chaves i18n órfãs; docs (`frontend.md` sem `withAppShell`, `BASELINE.md` R10, `e2e.md` com POMs/fixtures, `apps/web/README.md`, `packages/theme/README.md`); auditorias `/normalize apps/web` e `/security` (chave dos limitadores de auth).

**Out (deferred):**
- Port das mudanças de `.claude/**` para o `cuidda` (outro repositório — fica como pendência para o usuário decidir).
- Snapshots visuais no CI: as baselines são `darwin`; o job de CI roda os e2e funcionais e pula o spec visual até existirem baselines Linux geradas no mesmo container (decisão registrada no log).
- Qualquer mudança visual de design (Fase 0 bloqueada).

## 3. Acceptance criteria
- **AC-1** — Os ACs de teste das Fases 5–9 (AC-5.2, 5.3, 6.1, 6.2, 7.1–7.3, 8.1, 8.2, 9.1–9.3) têm spec correspondente e passam; cada spec novo tem caminho feliz e ao menos um negativo (E-H4) quando há fluxo de usuário.
- **AC-2** — `yarn test` e `yarn test:e2e` verdes localmente; baselines visuais estáveis em 3 execuções.
- **AC-3** — CI roda `build:web` e o e2e funcional da web.
- **AC-4** — Pendências herdadas resolvidas ou reclassificadas no roadmap com motivo.
- **AC-5** — `/normalize apps/web` sem Critical/High; `/security` sem Critical/High abertos.
- **AC-6** — Docs descrevem o código que existe (nenhuma referência a `withAppShell`, ao tema antigo ou a `modules/dashboard`).

## 4. Contracts & interfaces
Sem mudança de API pública. Helpers de teste novos no `e2e/fixtures/api-client.ts` (um HTTP call por função).

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Render com providers | `renderWithProviders` | `apps/web/src/test/render.tsx` | consumir |
| Sessão e2e | `global.setup.ts`, `api-client.ts` | `apps/web/e2e/` | estender |
| Leitura de CSS injetado | `injectedCssFor` | `AppModal.spec.tsx` | referência |

## 6. Files plan
Specs novos sob `apps/web/src/**` (co-localizados) e `apps/web/e2e/{pages,tests,fixtures}`; `.github/workflows/ci.yml`; componentes/hooks listados em 10d; docs listados em 10d.

## 7. Test plan
É a própria fase. Gates finais: `yarn type-check`, `yarn lint`, `yarn test`, `yarn build:web`, `yarn test:e2e` (3× para os visuais).

## 8. Diff budget
Grande por natureza (testes). Nenhuma dependência nova.

## Decisions log
- [2026-09-16] Fase dividida em sub-commits (10a–10d) para o usuário acompanhar pelo checkout da branch.
- [2026-09-16] 10a: +225 testes unitários na web (109 → 334), escritos por três agentes em paralelo sem tocar código de produção; cada um provou que os testes falham contra variantes quebradas. Achados corrigidos aqui: (1) o `useNotify` tratava `details` de `VALIDATION_ERROR` como mapa simples, mas a API manda o `flatten()` do Zod (`{ formErrors, fieldErrors }`) — o toast mostrava "[object Object]"; (2) exclusões sobrepostas de devices: a lista só é invalidada quando a última termina (antes, um refetch no meio podia trazer de volta um device ainda sendo excluído). Registrados sem mudança: ordem trocada quando duas exclusões sobrepostas falham (autocorrige no refetch); `resolveSignInRedirect` devolve o `from` antes de olhar `emailVerified` e descarta a query string; uma rajada do sandbox continua se o usuário sair da página.
- [2026-09-16] Revisão independente da Fase 10 roda uma vez no fechamento, sobre 10a–10d.
- [2026-09-16] 10c: CI ganha `yarn build:web` no job de checks e um job `e2e-web` que roda o próprio `yarn test:e2e` (docker compose com Postgres 15 + Redis 7 do `docker-compose.e2e.yml`, em vez de `services:` do Actions — um orquestrador só para local e CI). O `apps/api/.env.e2e` nunca foi versionado (o `e2e.md` dizia o contrário): criado `apps/api/.env.e2e.example` só com valores de teste, que o runner usa quando não há `.env.e2e` local; o runner força `WHATSAPP_ENABLED=false` e a checagem do usuário do seed usa o e-mail certo (`demo@example.com`, antes `felipe@pombo.dev`). `ignoreSnapshots` fora do macOS: os e2e visuais rodam no CI sem comparar pixels até existirem baselines Linux. Validado localmente sem `apps/api/.env` nem `.env.e2e`: a API sobe só com o exemplo e 15/17 passam — as 2 falhas são o baseline "buttons", que muda de propósito (variante `dangerOutline`).
- [2026-09-16] 10b: 9 specs novos (shell, auth ×3, devices ×2, sandbox, API token, perfil) com page objects em `e2e/pages/`, e um spec visual das telas (`design-system/screens-visual.spec.ts`: devices com o shell no desktop e no mobile, e o perfil, claro/escuro) com `/auth/me` e `/devices` respondidos no teste e relógio fixo — a conta do seed é compartilhada com specs que a renomeiam e criam devices. Estável em 3 execuções. Baselines regeneradas só para "buttons" (variante `dangerOutline`). O e2e achou três bugs, corrigidos aqui: (1) recarregar `/api` (página do token) no servidor de dev caía no proxy da API e mostrava JSON — o proxy agora devolve o SPA para navegações HTML; (2) os links da navegação inferior no mobile não tinham nome acessível (um `role="group"` sem uso apagava o texto); (3) o login travava com um cookie de sessão antigo (commit próprio, spec `auth-stale-session-lockout`). Ajustes de infraestrutura: `type-check` da web também checa `e2e/` (`tsconfig.e2e.json`); o runner força e-mail no console e sobe o limite do limitador de auth para 100 (as specs de auth passam do padrão de 10); nomes únicos de teste ganharam sufixo (dois devices criados no mesmo milissegundo colidiam); os dois page objects de perfil viraram um só.
- [2026-09-16] 10b revisada: 0 Critical/High. Mediums aceitos como pendência — `device-crud` e `sandbox-send` juntam vários fluxos num arquivo (cada `describe` com setup e limpeza próprios); o page object do token usa test ids no diálogo de confirmação onde o papel e o nome bastariam. Docs do `e2e.md` (estrutura de POMs e a citação do hook de debounce) ficam para a 10d.
- [2026-09-16] 10c (complemento): o job de testes unitários do CI falhava desde a Fase 1 — e também no `develop` — porque quatro specs da API carregam `core/config`, que encerra o processo sem `apps/api/.env`. Um setup do Vitest (`src/test/setup-env.ts`) carrega o `.env` local e completa o que faltar com o `.env.example` versionado. Validado sem o `.env`: 114 arquivos / 901 testes.
