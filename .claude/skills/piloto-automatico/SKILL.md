---
name: piloto-automatico
description: >-
  Processa as issues abertas do projeto de forma autônoma, UMA por vez — pega a
  próxima issue do milestone alvo, implementa pelo fluxo TDD do projeto, abre PR
  e habilita auto-merge, aplicando ao milestone (ex.: 0.4). Use quando o usuário
  quiser "programar as issues automaticamente", rodar o processo 24/7, ou pedir
  "/piloto-automatico". Cada invocação faz UMA issue; para repetir sozinho, agende
  com /schedule (nuvem, durável) ou /loop (sessão).
---

# Piloto automático — processar issues do projeto

Encapsula o fluxo de trabalho autônomo do the_monitor: a cada execução, pega **uma**
issue aberta e a leva de ponta a ponta (branch → TDD → PR → auto-merge), aplicando
ao milestone alvo. Ideias viram issues durante o dia; esta skill drena a fila.

## Milestone alvo
- Se o usuário passar um argumento (ex.: `/piloto-automatico 0.4`), use-o.
- Senão, use o **milestone aberto** do repo: `gh api repos/:owner/:repo/milestones --jq '.[]|select(.state=="open").title'` (se houver só um, é ele).

## Uma iteração (o que fazer a cada execução)

1. **Escolher a próxima issue.** `gh issue list --state open --milestone "<alvo>" --json number,title,labels,milestone`.
   Ordem de prioridade: (a) dependências resolvidas primeiro; (b) features de código
   antes de infra/meta; (c) mais antiga. Pule issues que dependem de outra ainda aberta.
2. **Ler e avaliar clareza** (`gh issue view <n>`). Regra do CLAUDE.md: só siga se
   estiver "dentro dos conformes".
   - **Ambíguo ou decisão de produto** (ex.: mudança breaking, escolha de arquitetura) →
     **pergunte ao usuário** com `AskUserQuestion` ANTES de codar. Não decida sozinho o
     que muda o comportamento pra usuários existentes.
   - **Grande com decisões em aberto** → entregue um **núcleo aditivo e seguro**, com
     testes a nível de dado, e **defira/documente** o resto no PR (não force o issue inteiro).
   - **Não implementável por você** (deploy manual, segredos, cloud) → faça a **parte
     automatizável** (scripts, workflows, compose, docs) e **documente o manual**; não finja pronto.
3. **Confirmar dependências:** se a issue constrói sobre um PR anterior, confirme que ele
   **mergeou** (`gh pr view <n> --json state`) antes de começar.
4. **Branch:** `git checkout master && git pull --ff-only`; `git checkout -b <tipo>/<n>-<slug>`
   (`feat/`, `fix/`, `chore/`, `docs/`).
5. **TDD (nunca commita vermelho):**
   - Escreva o teste primeiro. Para **lógica de dados**, teste no **backend com pytest**
     reproduzindo o cenário (função pura + endpoint) — ver regra no CLAUDE.md.
   - Implemente até verde. Rode a **suíte inteira** (backend `pytest`, frontend `npm test`)
     e o `test_migrations.py` se mexeu em model. Respeite as convenções do CLAUDE.md
     (migrations em `batch_alter_table`, base da API same-origin, auth-guard).
6. **Milestone:** aplique o alvo à issue — `gh issue edit <n> --milestone "<alvo>"`.
7. **PR + auto-merge:**
   - Commit com trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
   - `git push -u origin <branch>`; `gh pr create` (corpo: o quê / como / testes).
   - `gh pr merge <pr> --auto --squash` — com CI verde, mergeia sozinho e apaga a branch.
8. **Fechar a issue:** use a keyword **em inglês** no corpo do PR — `Closes #<n>`
   (`Fecha` NÃO fecha automático). Se a entrega **não** resolve 100% (núcleo parcial,
   infra manual, blocker) → **não** use `Closes`; escreva "Relaciona #<n>" e deixe aberta.
9. **Registrar progresso** com a task list (`TaskCreate`/`TaskUpdate`) e reportar ao usuário:
   o que foi feito, PR, e o que ficou de follow-up.

## Rodar 24/7 (agendamento)
- **Durável (recomendado p/ 24/7):** `/schedule` cria uma rotina na **nuvem** que roda
  esta skill em cron mesmo com a sessão/terminal fechados. Ex.: agendar
  `/piloto-automatico 0.4` de hora em hora.
- **Sessão:** `/loop 1h /piloto-automatico 0.4` roda enquanto o terminal estiver aberto
  (o cron da sessão morre ao fechar). Bom para acompanhar de perto.
- A fila se auto-atualiza: basta **abrir novas issues** no milestone durante o dia — a
  próxima execução pega a mais prioritária ainda aberta.

## Limites (não faça sozinho)
- Não faça merge de mudança **breaking** ou decisão de produto sem confirmar com `AskUserQuestion`.
- Não feche issue que exige passo **manual/humano** (deploy, credenciais).
- Uma issue por execução — não empilhe várias no mesmo run.
