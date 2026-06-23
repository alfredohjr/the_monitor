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

## Regra: nunca commita vermelho.
