# Task Spec — web-rebuild-telas-handoff

| | |
|---|---|
| **Status** | in progress |
| **Branch** | `claude/web-rebuild-roadmap-5b5abe` (um commit por tela) |
| **Date** | 2026-09-16 |
| **Size / Risk** | L / Medium |
| **Specialist** | /frontend |
| **Handoff** | `Pombo Login.dc.html`, `Pombo Sandbox.dc.html`, `Pombo Profile.dc.html`, `Pombo API.dc.html` |

## 1. Goal
Levar as quatro telas restantes do handoff para o app, na mesma linguagem já aplicada no tema e na Home.

## 2. Scope
**In:** login (bloco de marca + cartão), sandbox, perfil e API — layout, tipografia e estados. Snapshots visuais de cada tela, claro e escuro.

**Out:** capacidades que o backend não tem (ex.: "manter conectado" no login), atalhos de teclado (decisão do usuário), mudanças de contrato de API além do que cada tela exigir.

## 3. Acceptance criteria
- **AC-1** — Cada tela segue o handoff em estrutura, tipografia e cor, nos dois modos.
- **AC-2** — Nenhuma tela exige rolagem além do conteúdo real (a de detalhe do dispositivo tem teste que garante isso).
- **AC-3** — type-check, lint e `build:web` verdes a cada commit; baselines atualizadas e conferidas.

## Decisions log
- [2026-09-16] Login: o bloco de marca ganhou a manchete com a palavra destacada, o selo flutuante com anel e as três etiquetas ("api operando" com ponto vivo). O ícone do Pombo continua no lugar do "P" do handoff — a marca do produto é o pássaro.
- [2026-09-16] Login: "manter conectado" ficou de fora — a sessão hoje não tem essa opção no backend, e inventar um checkbox sem efeito seria pior que não ter.
- [2026-09-16] O subtítulo do cartão de login passou a ser "Entre para gerenciar seus devices"; a manchete do produto vive só no bloco de marca, como no handoff.
- [2026-09-16] O spec visual ganhou a tela de login (deslogada), com o botão do Google mascarado — ele é um iframe do Google, fora do nosso controle.
- [2026-09-16] Sandbox: cabeçalho com a etiqueta "N device pronto", contador de caracteres no rótulo da mensagem, ações do compositor separadas por régua (limpar discreto + enviar em verde suave) e painel da fila com cabeçalho próprio, linhas numeradas e limpeza só da fila. O contador não mostra limite porque a API não impõe um; inventar "/1024" seria mentira na tela.
- [2026-09-16] Perfil: quatro cartões — identidade (avatar com o botão de foto na borda), dados pessoais, preferências (idioma e tema saíram do cabeçalho para cá) e senha — com o botão salvar no fim. O controle de tema virou dois botões (escuro/claro), como no handoff, no lugar do interruptor; o seletor de idioma virou três botões com bandeira e código. O POM do shell precisa apontar para os novos botões (ajuste na etapa de testes).
- [2026-09-16] API: coleção do Postman saiu para o cabeçalho, e o cartão do token virou título + "criado em · último uso" + "gerar novo", com a caixa do prefixo e a nota de rotação. O handoff mostra revelar e copiar o token inteiro a qualquer momento; no Pombo isso não existe — o token só aparece uma vez, logo depois de gerado. A tela mostra o prefixo (que identifica o token sem servir de credencial) e diz isso na nota.
- [2026-09-16] Etapa de testes (deixada para o fim, como o usuário pediu): 901 unitários da API e 354 da web verdes; e2e 80/80. Ajustes que os testes pediram: o rótulo da mensagem no sandbox carrega o contador, então o page object casa pelo começo do texto; o teste de cadastro passou a simular também a fila (a Home consulta esse número agora); a linha da fila não repete mais o status em texto e selo.
- [2026-09-16] Sidebar: a frase "Seu gateway de mensagens" encostava na borda em 244px; no lugar dela entra a versão do build, como no handoff (e ela saiu do menu da conta, onde estava duplicada). A legenda do card de device encurtou ("Ativo desde …") para não ser cortada.
