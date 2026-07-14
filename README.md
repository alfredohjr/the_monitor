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

## Deploy e versionamento

### Linhas de versão
- **`master`** = linha de desenvolvimento atual (hoje `0.4.0-dev`).
- **`release/0.3`** = linha de manutenção estável; recebe só patches `0.3.x`.

Correção de bug: **corrija primeiro na linha mais antiga afetada** (ex.: `release/0.3`),
libere o `0.3.x` e depois **leve o fix para o `master`** (forward-port). Como os
PRs entram por *squash*, o forward-port é feito por **cherry-pick** — há uma
action que automatiza isso: adicione no PR o label `port:<branch>`
(ex.: `port:master` para forward-port, `port:release/0.3` para backport) e ela
abre o PR de cherry-pick na branch alvo.

Ao empurrar uma tag `v0.3.x` **estável**, o workflow `forward-port-reminder.yml`
abre automaticamente um issue lembrando de forward-portar o fix para o `master`
(a decisão e o cherry-pick seguem manuais — o bot é só o gatilho).

### Publicação de imagens (GHCR)
Ao empurrar uma tag `vX.Y.Z`, o CI (`.github/workflows/release.yml`) publica as
imagens no GHCR com a tag exata **e** uma tag móvel `X.Y`:

- `v0.4.0` → `ghcr.io/…/the_monitor-backend:0.4.0` **e** `:0.4`
- `v0.3.1` → `…:0.3.1` **e** `:0.3`
- `v0.4.0-dev.1` (pré-release) → só `…:0.4.0-dev.1` (não move `0.4` nem `latest`)

### Rodar em produção com auto-update travado na linha
`docker-compose.prod.yml` roda as imagens do GHCR e inclui um **Watchtower** que
atualiza sozinho quando a tag móvel recebe um novo patch:

```bash
docker compose -f docker-compose.prod.yml up -d
```

A linha seguida é definida **só** pela tag no compose (`:0.3`). Enquanto ela
apontar para `0.3`, você recebe todos os `0.3.x` e **nunca** cruza para `0.4`
automaticamente — migrar de linha (`:0.4`) é um ato manual e deliberado.

> As imagens no GHCR nascem privadas (vinculadas ao repo). Para o host de deploy
> puxar, faça `docker login ghcr.io` nele (ou torne os pacotes públicos).

### Que versão está rodando?
- `GET /version` e o rodapé do front mostram a versão (`v0.4.0-dev`, `v0.3.1`…).
  Em imagem publicada, o CI injeta a tag exata via build-arg, então o `/version`
  reflete o patch real.
- Comparação definitiva: o **digest** da imagem (`docker compose images`) e as
  **labels OCI** (`org.opencontainers.image.version`/`.revision`).

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
