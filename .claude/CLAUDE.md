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
