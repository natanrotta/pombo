# Task Spec — web-rebuild-fase-7-devices

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (uma fase por commit) |
| **Date** | 2026-09-16 |
| **Size / Risk** | M / Medium |
| **Specialist** | /frontend |
| **Roadmap** | `docs/web-rebuild/roadmap.md` § Fase 7 — **parte estrutural** |

## 1. Goal
Deixar `modules/devices` à altura de módulo canônico: botão de exclusão vermelho de verdade, exclusão otimista, cache mexido só pelos hooks, prefetch no hover e um estado próprio quando o gateway do WhatsApp está desligado. O visual atual é mantido.

## 2. Scope
**In:**
- Variante `dangerOutline` no recipe de botão (`packages/theme`, tokens `status.error.*`, mesmo formato do `outline`); o "Excluir" do detalhe passa a usá-la (hoje sai verde — defeito registrado na Fase 4).
- Remover todo `colorPalette` inerte dos botões do módulo (cabeçalho e filtro da lista; conectar/desconectar/excluir do detalhe; "tentar de novo" do QR).
- `useDeleteDevice` otimista: tira o device da lista em `onMutate`, desfaz em `onError`, descarta os caches `detail`/`qr`/`groups` do id no sucesso e invalida a lista no fim.
- `QrConnectModal` sem `useQueryClient`: um hook `useRefreshDevice()` em `useDevices.ts` invalida `detail(id)` + `list()`.
- `usePrefetchDevice()` no hook do módulo; `DeviceCard` repassa `onHover` ao `EntityCard` (padrão do `frontend.md` § Data-fetching, item 4).
- Conexão que falha com `WA_GATEWAY_DISABLED`: `EmptyState` (size `sm`) próprio no modal, sem "tentar de novo"; chaves novas nas 3 locales.

**Out (deferred):**
- Estado `DEVICE_OFFLINE` dos grupos: vive no `SandboxPage` → Fase 8.
- Testes: e2e de CRUD/conexão, specs dos hooks, snapshots (AC-7.1–7.3) → Fase 10 (AC-10.5). A variante nova muda o baseline "buttons" da galeria; a Fase 10 regenera.
- Visual conforme o design (Fase 0 bloqueada).

**Contratos intocados:** rotas, `data-cy`s, segredo de webhook exibido uma vez, poll do QR a cada 3 s com `gcTime: 0`, autosave dos webhooks (1500 ms) + guarda de alterações.

## 3. Acceptance criteria
- **AC-1** — O "Excluir" do detalhe fica vermelho em repouso (texto/borda `status.error.*`) e na interação, nos dois modos de cor; a galeria mostra a variante.
- **AC-2** — Nenhum `colorPalette` em `Button` dentro de `modules/devices`.
- **AC-3** — Excluir some da lista na hora; um erro da API devolve o item e mostra o toast; os caches inativos do id excluído saem, e o detalhe excluído não fica no histórico.
- **AC-4** — Nenhum componente de `modules/devices` importa `useQueryClient`; o modal de QR atualiza os caches pelo hook.
- **AC-5** — Passar o mouse/foco num card pré-carrega o detalhe do device.
- **AC-6** — Com o gateway desligado, o modal de conexão mostra o estado próprio (sem retry); outras falhas mantêm o painel com retry.
- **AC-7** — Contratos intocados; i18n nas 3 locales; `type-check`, `lint`, `build:web` verdes.

## 4. Contracts & interfaces
Sem mudança de API. Hooks novos: `useRefreshDevice(): (id: string) => void`, `usePrefetchDevice(): (id: string) => void`. `DeviceCardProps` ganha `onHover: (id: string) => void`. Recipe: variante `dangerOutline`. i18n: `devices.qr.gatewayDisabled.{title,description}`.

## 5. Reuse map
| Need | Existing | Path | Action |
|---|---|---|---|
| Otimismo | padrão canônico | `.claude/patterns/frontend.md` § Optimistic Updates | copiar |
| Prefetch | `EntityCard.onHover` | `shared/components/ui/EntityCard.tsx` | consumir |
| Estado vazio | `EmptyState` | `shared/components/ui/EmptyState.tsx` | consumir |
| Variante de botão | `outline`, `danger` | `packages/theme/src/foundations/recipes.ts` | estender |

## 6. Files plan
**Modify:** `packages/theme/src/foundations/recipes.ts`, `modules/devices/presentation/hooks/useDevices.ts`, `modules/devices/presentation/pages/{DevicesListPage,DeviceDetailPage}.tsx`, `modules/devices/presentation/components/{DeviceCard,QrConnectModal}.tsx`, `shared/i18n/locales/{pt-BR,en,es}/devices.json`, `.claude/patterns/frontend.md` (nota da variante).

## 7. Test plan
Por decisão do usuário (roadmap §7), nada de teste escrito ou executado nesta fase. Gates: `type-check`, `lint`, `build:web`. AC-7.1–7.3 → Fase 10.

## 8. Diff budget
0 arquivos criados (fora esta spec), ~10 modificados. Nenhuma dependência nova.

## Decisions log
- [2026-09-16] Parte estrutural só; testes adiados (pedido do usuário); `/duck-debug` não é obrigatório na Fase 7 (roadmap §7).
- [2026-09-16] Vermelho do "Excluir" via variante de recipe (`dangerOutline`), não via props de estilo na página: é a segunda ação destrutiva com contorno e a galeria passa a mostrá-la.
- [2026-09-16] `DEVICE_OFFLINE` fica para a Fase 8: o seletor de grupos é do Sandbox.
- [2026-09-16] Pós-exclusão, os caches `detail`/`qr`/`groups` do id saem só se estiverem inativos: remover uma query ainda observada (a página de detalhe saindo pela animação) faria o observer refazer o GET e tomar 404. Excluir pelo detalhe navega com `replace`, para o "voltar" não cair no device excluído; o cache do detalhe some pelo `gcTime`.
- [2026-09-16] Ícone do estado "gateway desligado": `FiSlash` (o mesmo de "desconectados" na lista), sem ícone novo no barrel.
- [2026-09-16] O `frontend.md` agora diz para não passar `colorPalette` a um `Button` e documenta as duas variantes destrutivas.
- [2026-09-16] Babysit: auditor 0 Critical/High/Medium (1 Low aplicado: `_hover.borderColor` redundante no `dangerOutline`). Revisor: 1 High corrigido — o rollback restaurava o snapshot inteiro e, com duas exclusões sobrepostas (o `useConfirm` fecha antes da mutação terminar), ressuscitava o device da outra exclusão; agora o `onError` devolve só o item que falhou, na posição original (`restoreDevice`), e o trecho canônico do `frontend.md` foi corrigido junto. Low registrado (fora do escopo): os `queryFn` não repassam o `signal`, então `cancelQueries` não aborta o HTTP — varredura sistêmica para a Fase 10.
