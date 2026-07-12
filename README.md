# the_monitor

Dashboard de monitoramento com backend FastAPI e frontend Next.js.

## Estrutura

```
├── backend/   # FastAPI + SQLModel
└── frontend/  # Next.js 15 + React 19
```

## Rodando com Docker (recomendado)

O projeto roda em **containers** orquestrados por **Docker Compose**
(`docker-compose.yml`), com três serviços:

| Serviço    | Imagem/base           | Porta          |
| ---------- | --------------------- | -------------- |
| `db`       | `postgres:16-alpine`  | `5433 → 5432`  |
| `backend`  | FastAPI (Python 3.12) | `8000`         |
| `frontend` | Next.js (Node 20)     | `3000`         |

Os serviços leem variáveis de um arquivo **`.env`** na raiz (ao menos
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`). Crie-o antes de subir.

Há scripts prontos que limpam containers, derrubam o stack e sobem tudo com
build:

```bash
# Linux / macOS
./run.sh
```

```bat
:: Windows
run.bat
```

Ambos executam o equivalente a:

```bash
docker container prune
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up --build
```

Depois: frontend em <http://localhost:3000> e API em <http://localhost:8000>.

## Rodando localmente (sem container)

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

## Principais tecnologias e versões

**Backend** (Python 3.12)

| Tecnologia   | Versão   | Papel                                  |
| ------------ | -------- | -------------------------------------- |
| FastAPI      | 0.120.0  | Framework da API                       |
| SQLModel     | 0.0.27   | ORM/modelos                            |
| Uvicorn      | 0.34.3   | Servidor ASGI                          |
| Alembic      | 1.13.2   | Migrations                             |
| psycopg2     | 2.9.10   | Driver PostgreSQL                      |
| PyJWT        | 2.9.0    | Tokens JWT                             |
| google-auth  | 2.35.0   | Login com Google                       |
| APScheduler  | 3.11.3   | Agendamento (resumo diário por e-mail) |
| pytest       | 8.3.5    | Testes                                 |

**Frontend** (Node 20)

| Tecnologia   | Versão   | Papel                     |
| ------------ | -------- | ------------------------- |
| Next.js      | 15.5.6   | Framework React (App Router) |
| React        | 19.1.0   | UI                        |
| TypeScript   | 5.x      | Linguagem                 |
| Tailwind CSS | 4.x      | Estilos                   |
| Recharts     | 2.15.4   | Gráficos                  |
| Jest + Testing Library | 29.x / 16.x | Testes             |

**Infra**

| Tecnologia     | Versão        |
| -------------- | ------------- |
| PostgreSQL     | 16 (alpine)   |
| Docker Compose | orquestração  |

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
