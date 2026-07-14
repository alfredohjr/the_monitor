# Deploy com auto-update travado na linha minor (#146)

Uma instância se atualiza sozinha **dentro de uma linha minor** (ex.: só `0.4.x`,
nunca pula para `0.5.x`). Abordagem: **imagens no GHCR + tag móvel + Watchtower**.

## Como funciona (visão geral)

```
git tag v0.4.1  ──►  CI (release.yml)  ──►  GHCR publica:
   (fonte da verdade)                         the_monitor-backend:0.4.1  (patch exato)
                                              the_monitor-backend:0.4    (tag MÓVEL)
                                              + labels OCI + build-arg APP_VERSION
                                                        │
   docker-compose.prod.yml roda  image: …:0.4  ◄────────┘
                                                        │
   Watchtower (a cada 5 min) vê o digest de :0.4 mudar ──► pull + recreate
```

- **Ponto de trava:** a tag `:0.4` no `docker-compose.prod.yml`. É o *único* lugar
  que decide qual série a instância segue. Migrar de linha = trocar para `:0.5`
  (ato deliberado). **Nunca use `latest`.**
- Quando sair a `0.5.0`, a tag `0.4` **para de andar** → a instância não cruza
  de minor sozinha.

## Qual patch está rodando

- **App:** `GET /version` (backend) e o rodapé do front (`v0.4.x`). Ambos refletem
  o **build-arg `APP_VERSION`** injetado pelo CI — não é mais hardcoded (#146):
  - backend: `ARG APP_VERSION` → `ENV APP_VERSION` → `/version`.
  - frontend: `ARG APP_VERSION` → `ENV NEXT_PUBLIC_APP_VERSION` (inlinado no build) → rodapé.
- **Labels OCI:** `docker inspect ghcr.io/.../the_monitor-backend:0.4` mostra
  `org.opencontainers.image.version` (= `0.4.1`) e `.revision` (git SHA).
- **Digest:** `docker compose -f docker-compose.prod.yml images` — comparador
  definitivo de "atualizou ou não".

## Rollback / patch ruim

- Os serviços `backend`/`frontend` têm **healthcheck**: um patch que sobe quebrado
  fica `unhealthy` e é reiniciado (`restart: unless-stopped`).
- Watchtower **não faz rollback automático**. Se um patch ruim entrar, faça o
  rollback manual fixando o patch anterior por tag exata ou digest:
  ```bash
  # trava temporariamente num patch bom enquanto investiga
  docker compose -f docker-compose.prod.yml pull backend
  # edite a image para :0.4.0 (ou @sha256:…) e:
  docker compose -f docker-compose.prod.yml up -d
  ```
- Opcional: fixar por **digest** (`image: …@sha256:…`) desliga o auto-update
  daquele serviço até você atualizar o digest de propósito.

## Passos manuais (dependem do ambiente — NÃO automatizados aqui)

1. **Servidor de deploy** com Docker + Docker Compose.
2. **`.env`** ao lado do compose com `POSTGRES_USER` / `POSTGRES_PASSWORD` /
   `POSTGRES_DB` (e demais segredos do app).
3. **Pacotes GHCR públicos** ou login no servidor:
   `echo $GHCR_PAT | docker login ghcr.io -u <user> --password-stdin`
   (PAT com escopo `read:packages`). Se os pacotes forem públicos, o pull é anônimo.
4. Subir: `docker compose -f docker-compose.prod.yml up -d`.
5. **Cortar um release** (dispara o CI e a publicação):
   ```bash
   git tag v0.4.1 && git push origin v0.4.1
   ```
   Pré-releases (`v0.4.1-dev.1`) **não** movem a tag `0.4` nem `latest` — a linha
   estável fica protegida.

## Arquivos

- `.github/workflows/release.yml` — build + push no GHCR em push de tag `v*`.
- `docker-compose.prod.yml` — roda por `image:` (pull), tag móvel, Watchtower, healthchecks.
- `backend/Dockerfile`, `frontend/Dockerfile` — build-arg `APP_VERSION`.
