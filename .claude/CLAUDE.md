# the_monitor — Regras do Projeto

## Stack
- **Backend**: FastAPI + SQLModel (Python) — `backend/`
- **Frontend**: Next.js 15 + React 19 (TypeScript) — `frontend/`

## Fluxo de trabalho (TDD)

1. Chegou demanda → lê e entende o escopo
2. Verifica se está dentro dos conformes (requisitos claros, sem ambiguidade)
3. Cria a branch: `git checkout -b feat/<nome>`
4. Escreve o teste primeiro (vermelho)
5. Implementa o código até o teste passar (verde)
6. Refatora se necessário, mantendo verde
7. Commit + PR

### Se o teste falhar após a implementação
- **Erro no código** → corrige o código, roda de novo (não mexe no teste)
- **Erro no teste** → releu errado a demanda, corrige o teste e volta ao passo 2
- **Erro de ambiente** → resolve dependência/config e roda de novo
- **Bloqueio real** → descreve no PR e pede revisão

## Testes

### Backend
```bash
cd backend
pytest
```
Testes em `backend/tests/`.

### Frontend
```bash
cd frontend
npm test
```
Testes em `frontend/src/__tests__/`.

## Regra: priorizar testes a nível de dados (backend)

Bugs de **lógica de dados** (agregação, filtro, cálculo, transformação) devem ser
validados **no backend com pytest**, reproduzindo o cenário real — de preferência
via API (TestClient) ou montando os dados como vêm do banco. Quanto mais perto do
dado o teste está, mais bugs pegamos antes de chegar ao usuário.

Diretriz para daqui pra frente:
- Se a lógica é agregação/transformação de dados, **coloque-a (ou espelhe-a) no backend**
  como função pura + endpoint, e escreva o teste `pytest` que **reproduz o bug** antes de corrigir.
- Escreva **mais** testes desse nível ao longo do tempo; o teste de componente (front) passa a
  verificar só que a tela **consome** o que o backend entrega.
- Exemplo de referência: `backend/progress.py` + `backend/tests/test_progress.py` (realizado x meta
  por período) e o endpoint `/api/v1/metrics/{id}/progress`.
- DB local para inspeção (somente leitura): `localhost:5433`, db `monitor_db`, user `monitor`.

## Regra: nunca commita vermelho.

## Regra: auth guard em toda página protegida

Toda página/componente que exige login **deve**:

1. Verificar `localStorage.getItem("access_token")` no `useEffect`
2. Redirecionar para `/login` se não houver token
3. Ter teste em `frontend/src/__tests__/auth-guard.test.tsx`

Padrão mínimo obrigatório no componente:
```tsx
useEffect(() => {
  const token = localStorage.getItem("access_token");
  if (!token) return router.push("/login");
  // ... busca de dados
}, [router]);
```

Ao criar uma nova página protegida, adicionar o componente nos dois `describe` de `auth-guard.test.tsx`.

## Convenções e gotchas (mantido em dia)

### Migrations (Alembic + SQLite)
Todo novo model/coluna precisa de migration em `backend/alembic/versions/`.
- **Use `batch_alter_table`** para `add_column`/`drop_column`/FK — o SQLite (usado
  nos testes) não faz `ALTER` de constraint direto. Colunas `NOT NULL` novas em
  tabela com dados precisam de `server_default`. Espelhe o padrão de
  `f6a7b8c9d0e1_scope_metric_goal_log_by_org.py`.
- `backend/tests/test_migrations.py` valida **models ↔ migrations** em sincronia
  (`compare_metadata`) e roda o upgrade do zero em SQLite. Rode-o ao mexer em model.

### Frontend — base da API (nunca hardcode `localhost:8000`)
Use `API_BASE` de `@/lib/api` (ou `apiFetch` com path relativo `/api/v1/...`). Em
produção o front é same-origin atrás de proxy: `NEXT_PUBLIC_API_BASE=""` faz as
chamadas irem pra `/api/v1/...`. Sem env (dev/testes) cai em `localhost:8000`.

### Permissões: lançador vs admin (por organização)
- Admin da org define, por lançador, **quais métricas** ele manipula
  (`UserMetricAssignment`) e as flags **`can_edit_entry` / `can_delete_entry`**.
- Lançador só **vê/lança** nas métricas atribuídas, e só **edita/exclui os
  próprios** lançamentos com a flag ligada — senão **403** (validado no backend).
- **Admin bypassa** todas as flags. Edição/exclusão gera trilha em `LogEntryAudit`.
- A UI espelha as permissões efetivas via `GET /api/v1/me/log-permissions/`.

### Deploy e versionamento
Detalhes no `README.md` (§ *Deploy e versionamento*) e em `deploy/vps/`:
- Linhas: **`release/0.3`** (manutenção 0.3.x) e **`master`** (`0.4.0-dev`).
- Corrigir na linha mais antiga afetada e **forward-portar** por label
  **`port:<branch>`** (cherry-pick — o merge de branch conflita com o squash).
- Imagens no **GHCR** com tag móvel `MAJOR.MINOR` + **Watchtower** (auto-update
  travado na minor). Versão do app vem do build-arg `APP_VERSION` (não hardcode).

### Fluxo de merge
PR + `gh pr merge --auto --squash`: com CI verde, mergeia sozinho e apaga a branch.
