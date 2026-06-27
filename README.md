# the_monitor

Dashboard de monitoramento com backend FastAPI e frontend Next.js.

## Estrutura

```
├── backend/   # FastAPI + SQLModel
└── frontend/  # Next.js 15 + React 19
```

## Rodando

### Backend
```bash
cd backend
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload
```

O schema do banco é gerenciado por **migrations (Alembic)**. As migrations
pendentes são aplicadas **automaticamente no startup** do app. Para rodar
manualmente:

```bash
cd backend
.venv/bin/alembic upgrade head        # aplica migrations
.venv/bin/alembic revision --autogenerate -m "descricao"   # cria nova migration apos mudar um model
```

> **Banco antigo (criado antes do Alembic)?** Se o seu banco já tinha tabelas
> criadas sem migrations, o `upgrade` falha (tabelas já existem). Em dev, o
> mais simples é recriar: apague o `database.db` (SQLite) ou drope/recrie o
> banco (Postgres) e suba o app — as migrations criam tudo do zero.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testes

### Backend
```bash
cd backend
.venv/bin/pytest
```

### Frontend
```bash
cd frontend
npm test
```

## Licença

Distribuído sob a [Business Source License 1.1](LICENSE) (BUSL-1.1).

O código é aberto para leitura e uso, **exceto** oferecê-lo a terceiros como
serviço hospedado/gerenciado concorrente. Em **2030-06-26** a licença converte
automaticamente para Apache-2.0. Para licenciamento comercial, contate
alfredojrgasper@gmail.com.

## Autor

- Alfredo Holz Junior

## Histórico

- 2026-06-23 — início do projeto
