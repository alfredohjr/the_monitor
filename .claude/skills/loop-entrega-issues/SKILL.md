---
name: loop-entrega-issues
description: >-
  Loop recorrente que DRENA a fila de issues E entrega em PRODUÇÃO — uma issue por
  ciclo (tipicamente 1/hora). A cada ciclo: checa issues/PRs, entrega UMA issue
  entregável (fluxo piloto-automatico), faz o forward-port pra release/0.4 + corta a
  tag v0.4.x (o merge no master NÃO deploya), e reagenda o próximo ciclo com
  ScheduleWakeup. Use quando o usuário pedir para "rodar o loop", "processar as issues
  de hora em hora", validar/registrar issues pelo celular enquanto o loop entrega, ou
  pedir "/loop-entrega-issues". Complementa [piloto-automatico] com o passo de DEPLOY e
  a orquestração recorrente.
---

# Loop de entrega de issues (com deploy em produção)

Orquestra a entrega contínua do the_monitor: a cada ciclo pega **uma** issue entregável,
leva de ponta a ponta (branch → TDD → PR → auto-merge) **e a coloca em produção**
(forward-port + tag), depois **reagenda** o próximo ciclo. O usuário registra issues
novas pelo celular durante o dia; o loop as drena sozinho.

> A entrega de UMA issue segue a skill **piloto-automatico** (TDD, PR, auto-merge). Esta
> skill adiciona o que falta para o loop 24/7: **o deploy** e o **reagendamento**.

## Um ciclo (o que fazer a cada wakeup)

1. **Levantar o estado:** `gh issue list --state open` e `gh pr list`.
2. **Filtrar entregáveis.** Entregável = clara, sem ambiguidade, sem decisão de produto
   pendente, e **sem PR aberto**. IGNORE (não implemente sozinho):
   - Issues **ambíguas/vagas** ("ajustar telas", sem escopo) → peça esclarecimento, não invente.
   - Issues que dependem de **decisão de produto/modelo inexistente** (billing, semântica
     que muda dados já gravados) → `AskUserQuestion` quando o usuário estiver presente; senão deixe pendente.
   - Issues já **adiadas** pelo usuário.
   - Cheque comentários novos (`gh issue view N --json comments`) — o usuário pode ter esclarecido; reavalie.
3. **Se houver ≥1 entregável:** entregue **UMA** (a próxima) pelo fluxo do **piloto-automatico**
   (branch do master → teste vermelho→verde → suíte inteira verde → PR).
   - **Fechar a issue:** `Closes #N` **em inglês** no corpo do PR (o GitHub NÃO fecha com "Fecha").
   - `gh pr merge <pr> --auto --squash`. Se o auto-merge falhar com **"unstable"** (checks
     ainda pendentes), faça poll `gh pr view <pr> --json state,mergeStateStatus` e mergeie quando passar.
4. **DEPLOY (obrigatório — o merge no master NÃO chega na produção):** ver seção abaixo.
5. **Reagendar:** `ScheduleWakeup delaySeconds=3600` com o mesmo prompt do loop.
   - Reagende **mesmo sem nada entregável** (o usuário ainda registra issues).
   - Só **pare** (`stop:true`) se o usuário pedir explicitamente.
6. **Reportar** curto: issue entregue + nº do PR + port/tag, ou "nada novo entregável,
   reagendado", e o que está **pendente de decisão** do usuário.

## Deploy — forward-port pra release/0.4 + tag (CRÍTICO)

Produção roda a linha **`release/0.4`** + **tag `v0.4.x`** → imagens GHCR → **Watchtower**.
O `master` é `0.5.0-dev` e **NÃO deploya**. Depois de mergear a issue no master:

1. Descubra o squash no master: `git fetch origin master release/0.4`; `git log origin/master --oneline -1`.
2. `git checkout -B forward-port/<n>-to-0.4 origin/release/0.4`.
3. `git cherry-pick <sha-do-squash> --no-edit`. Resolva conflitos com cuidado — a
   `release/0.4` é o master **menos** algumas features (ex.: pode não ter o #198), então
   um trecho que no master vem de outra PR pode conflitar; mantenha a base da 0.4 + só o
   que a issue adiciona.
4. Rode a suíte (`npm test` / `pytest`) na branch de port.
5. `git push -u origin forward-port/<n>-to-0.4`; `gh pr create --base release/0.4 ...`;
   `gh pr merge <pr> --auto --squash`.
6. **Antes de taggear, ESPERE o CI da release/0.4 ficar verde.** A proteção da `release/0.4`
   **não bloqueia** o merge no check — o PR pode mergear com checks pendentes. Poll:
   `gh run list --workflow=ci.yml --branch release/0.4 --limit 1 --json status,conclusion`
   até `completed success`.
7. Corte a tag (bump do patch — veja a última com `git tag --sort=-creatordate | head -1`):
   `git tag -a v0.4.<patch+1> origin/release/0.4 -m "..."` e `git push origin v0.4.<patch+1>`.
   O workflow `release.yml` publica as imagens; o Watchtower atualiza o VPS.

## Reagendamento (ScheduleWakeup)

- `delaySeconds=3600` (1/hora) é o padrão pedido pelo usuário. Passe **o mesmo prompt do
  loop** de volta a cada ciclo (assim o próximo firing repete a tarefa).
- Mantenha no prompt: a lista de **entregáveis** com specs, os **pendentes** (com o motivo),
  e o **último patch** taggeado (para o próximo bump).

## Gotchas aprendidos

- **"Fecha #N" (PT) não fecha** a issue no GitHub — use `Closes #N`. Issues entregues mas
  abertas assim: feche manualmente (`gh issue close N -c "Entregue no #PR, em produção na vX"`).
- **master ≠ produção.** Sempre faça o forward-port + tag; senão "a aplicação não pega".
- **release/0.4 não bloqueia no check** — espere o `ci.yml` verde antes de taggear.
- **Comandos compostos com git podem ser bloqueados** pelo classificador de sandbox —
  rode `git checkout`/`cherry-pick`/`merge` em chamadas separadas se um combo for negado.
- `NEXT_PUBLIC_APP_VERSION` já é injetado no build do frontend (Dockerfile `ARG APP_VERSION`
  + `release.yml`), então a versão exibida reflete a tag.

## Limites (não faça sozinho)

- Não implemente issue **ambígua** ou de **decisão de produto** sem `AskUserQuestion`.
- Uma issue por ciclo. Não empilhe várias no mesmo run.
- Não corte tag de produção com CI vermelho.
