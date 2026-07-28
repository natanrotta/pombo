# Roadmap — Cadência humana de envio (anti-ban por dispositivo)

> **Branch:** `feature/humanized-send-pacing` · **Base:** `origin/develop`
> **Escopo:** fazer **UM** número parecer humano ao enviar — indicador "digitando…" + variação de delay (jitter). **Sem** load balance.
> **Status:** E1 em andamento.

---

## Problema

Um dispositivo que envia mensagens em cadência de máquina (ritmo regular, sem "digitando", rajadas)
tem alto risco de ban no WhatsApp. Como estamos no **Baileys** (não na Cloud API oficial), **não existe
rede de segurança externa da Meta** — a única proteção é a cadência comportamental, e ela só pode ser
imposta onde o socket vive: no servidor.

## O que JÁ existe (não mexer)

- **Outbox persistido** (`outbox-message.entity.ts` + `prisma-outbox.repository.ts`) — toda mensagem vira linha no banco antes de sair.
- **Token-bucket por device** (`token-bucket-send-rate-limiter.ts`) — `SEND_RATE_MAX=20` / `SEND_RATE_WINDOW_MS=60000` (20/min). **É o TETO anti-ban.**
- **Drain paceado pelo rate limiter** (`drain-outbox.use-case.ts`) — FIFO, lotes de 200, single-flight por device.
- **Caminho de envio ao vivo** (`send-text-message.use-case.ts` / `send-rich-message.use-case.ts`) — envia inline quando online + com token; senão enfileira e chuta o drain.

## Tese central (decisão de arquitetura)

**Separar TETO de CADÊNCIA HUMANA.** São concerns complementares, não redundantes:

| Concern | Papel | Onde |
|---|---|---|
| **Token-bucket** | teto rígido "nunca passar de X/min" (freio de emergência) | já existe — **intocado** |
| **HumanPacer** | ritmo humano: delay variável ∝ conteúdo + "digitando…" | **novo** |

Com o pacer espaçando envios em ~5–15s, a vazão efetiva já cai abaixo do teto — o bucket vira rede de segurança que quase nunca dispara.

## Modelo de responsabilidade

O **anti-ban é responsabilidade do Pombo**, não do app consumidor:
- Quem paga a conta do ban é um **device do Pombo**; o consumidor só recebe erro.
- Só o servidor enxerga o estado real do socket (online, backlog, múltiplos chamadores no mesmo número).
- `sendPresenceUpdate('composing')` é **fisicamente** do socket Baileys — o consumidor não tem socket.

**Consumidor = intenção (o quê/quando/conteúdo). Pombo = mecanismo + segurança (como entregar humano e seguro).**
Flexibilidade futura = parametrizar o mecanismo do servidor (default-safe, override-explícito), nunca delegar o mecanismo.

## Fora de escopo (aditivo, cada um vira seu próprio plano depois)

- Warm-up de número novo (ramp-up por idade do device)
- Cap diário persistido por número
- Perfis de cadência por-device
- Knobs client-facing na API

---

## Sequenciamento

Partes aditivas (primitivas + lógica) entram primeiro, **com zero mudança de comportamento**, testáveis em isolamento.
A mudança de semântica (colapso do envio inline → drain) vem por último, atrás de flag.
**Pode-se parar em qualquer etapa com um sistema coerente.**

**Caminho crítico:** E1 → (validação live) → E2 → E3 → E4. E5/E6 são folha.

---

## E1 — Primitivas de presença no gateway *(aditivo, ninguém chama ainda)*

**Objetivo:** expor "digitando" no port, sem tocar em nenhum fluxo de envio.

**Muda:**
- `+setTyping(deviceId, jid, on: boolean): Promise<void>` em `whatsapp-gateway.interface.ts`
- Impl no `session-manager.ts` via `sock.sendPresenceUpdate('composing' | 'paused', jid)`
- Delegate no `baileys-whatsapp.gateway.ts`
- No-op no `disabled-whatsapp.gateway.ts`
- Record no `fake-whatsapp.gateway.ts`

**Aceitação:**
- [ ] `setTyping` existe no port e em todas as 3 implementações (baileys / disabled / fake)
- [ ] Fake gateway registra as chamadas (`on`/`off` por jid) para asserção
- [ ] Nenhum fluxo de envio existente muda de comportamento (test suite atual verde)

**Testes:** fake gateway registra chamadas; contrato do port coberto.

**↳ Gate de validação (obrigatório antes de E3):** com E1 mergeado, testar num **número real**:
o "digitando" renderiza? Expira em ~10s? Precisa de presença `available`? Calibrar `ms/char`. As constantes saem daqui para E2.

**Tamanho:** S

---

## E2 — `HumanPacer` (lógica pura + env knobs) *(aditivo, não plugado)*

**Objetivo:** o "cérebro" da cadência humana, provado em isolamento.

**Muda:**
- Novo provider `ISendPacer` / `HumanPacer` com `now()` e `random()` injetados (mesmo padrão do token-bucket)
- Calcula: pausa de leitura, `typingMs ∝ tamanho do texto` + jitter, pausa longa ocasional, cadência de refresh do `composing`
- Novos knobs em `env.ts` + `app-config.interface.ts`: `TYPING_MS_PER_CHAR`, `TYPING_MIN_MS`, `TYPING_MAX_MS`, `SEND_JITTER_PCT`, `LONG_PAUSE_PROBABILITY`, `LONG_PAUSE_MIN_MS`, `LONG_PAUSE_MAX_MS`, `HUMAN_PACING_ENABLED`

**Aceitação:**
- [ ] `HumanPacer` 100% determinístico com clock + random injetados
- [ ] `typingMs` cresce com o tamanho do texto, respeitando piso/teto
- [ ] Env knobs validados por Zod com defaults sãos

**Testes:** unitário puro, sem socket.

**Tamanho:** S/M

---

## E3 — Plugar pacer + typing no drain, atrás da flag *(primeira melhoria visível)*

**Objetivo:** humanizar o caminho drenado (offline / acima do budget), togglável.

**Muda:**
- `drain-outbox.use-case.ts` → em `sendOne`: pausa de leitura → `setTyping(on)` + loop de refresh → espera `typingMs` → `setTyping(off)` → `dispatchOutboxSend`
- Respeita os checks de `isConnected` e o `unref` que já existem
- Tudo sob `HUMAN_PACING_ENABLED` (default off no primeiro deploy → liga por env)

**Aceitação:**
- [ ] Ordem garantida: typing → wait → send
- [ ] Drain interrompe pacing se o device cair (respeita `isConnected`)
- [ ] Flag off → comportamento idêntico ao atual

**Testes:** drain spec afirma a ordem e o pacing com fake gateway + clock injetado.

**Depende de:** E1 (validado) + E2.

**Tamanho:** M

---

## E4 — Colapsar o fast-path inline → drain *(a virada semântica)*

**Objetivo:** 100% dos envios passam pelo drain humanizado; um só caminho.

**Muda:**
- `send-text-message.use-case.ts` e `send-rich-message.use-case.ts` → remove o `tryConsume` + o bloco de `gateway.send`/stamp/publish inline
- Mantém `resolveJid` (validação síncrona → `404 not on WhatsApp`) + cria outbox + **sempre** chuta o drain → `202`
- Token-bucket continua intocado, agora só como teto dentro do drain

**Aceitação:**
- [ ] Todo envio retorna `202` sem enviar inline
- [ ] `resolveJid` continua síncrono (404 imediato para número inexistente)
- [ ] Webhook `message.sent` continua disparando (agora sempre via drain)
- [ ] Specs de send-text/send-rich reescritos; asserções de envio migradas para o drain

**Testes:** reescreve os 2 specs de envio; confere timing do webhook `message.sent`.

**Depende de:** E3 estável.

**Tamanho:** M (custo = churn de teste, não lógica) — **deleta mais código do que adiciona**

---

## E5 — *(opcional)* Tique azul antes de responder

**Objetivo:** `markRead` da última mensagem recebida antes de enviar.

**Muda:** `+markRead` no gateway + chamada no drain. **Depende** de a `key` da última inbound estar acessível — se não estiver, **corta** esta etapa.

**Tamanho:** S (ou cortado)

---

## E6 — Rollout + observabilidade + docs *(finish)*

**Objetivo:** ligar com segurança e deixar rastro.

**Muda:** log em debug das decisões de pacing (typingMs, pausas); documenta os env knobs; liga `HUMAN_PACING_ENABLED` por ambiente (staging → prod). Profundidade de fila por device já existe (`getQueueHealth`).

**Tamanho:** S
