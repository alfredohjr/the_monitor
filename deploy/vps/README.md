# Deploy — VPS x86_64 + Cloudflare (#190)

Sobe Next.js + FastAPI + PostgreSQL numa VPS, com **Caddy** de reverse proxy interno
e **Cloudflare** na frente (proxy/WAF/DDoS, esconde o IP da VPS).

```
Visitante ──HTTPS──> Cloudflare ──HTTPS──> Caddy (VPS)
                                            ├── /api/*  -> backend  (FastAPI :8000)
                                            └── /*      -> frontend (Next.js :3000)
                                                            backend -> postgres :5432
```

**Não builda nada.** Sendo amd64, as imagens do GHCR (#146) rodam nativo. O compose
usa a tag móvel `:0.4` e o **Watchtower** puxa os patches dela sozinho — o
auto-update fica travado na minor (não cruza pra 0.5).

## Arquivos deste diretório

| Arquivo | O quê |
|---|---|
| `docker-compose.yml` | Stack completa (imagens do GHCR), só o Caddy exposto |
| `Caddyfile` | Variante A (Origin Certificate + TLS) |
| `Caddyfile.tunnel` | Variante B (Cloudflare Tunnel, HTTP interno) |
| `.env.example` | Modelo do `.env` (copie e preencha) |
| `backup.sh` | `pg_dump` agendável com retenção |

## Passo a passo

### 1. VPS
- Ubuntu com Docker Engine + plugin `docker compose`.
- Nada de nginx/apache: o Caddy ocupa as portas 80/443.

### 2. Código e config
```bash
git clone <repo> && cd numeroUm
cp deploy/vps/.env.example deploy/vps/.env   # preencha os valores
```

Gere o `SECRET_KEY` (sem ele o backend sobe com o segredo público do repo, #191):
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 3. Cloudflare — escolha a variante

**Variante A — proxy laranja + Origin Certificate** (mais simples de operar):
1. Cloudflare → **SSL/TLS → Origin Server → Create Certificate**. Salve como
   `deploy/vps/certs/origin.pem` e `origin.key` na VPS.
2. **SSL/TLS → Overview**: modo **Full (strict)**.
3. **DNS**: registro **A** → IP público da VPS, **proxy ligado** (nuvem laranja).
4. **Firewall** (crucial): libere 80/443 **só** das faixas do Cloudflare
   (`https://www.cloudflare.com/ips/`) — no firewall do provedor **e** no
   `iptables`/`ufw` da VPS. Sem isso, quem descobrir o IP contorna o Cloudflare.

**Variante B — Cloudflare Tunnel** (mais segura, nenhuma porta aberta):
1. **Zero Trust → Networks → Tunnels**: crie o túnel, copie o **token** →
   `TUNNEL_TOKEN` no `.env`.
2. Public hostname do túnel → `http://caddy:80`.
3. No compose: descomente `cloudflared`, **remova o bloco `ports:` do caddy**, e
   troque o Caddyfile pelo `Caddyfile.tunnel`.
4. DNS é criado pelo próprio túnel; 80/443 podem ficar **fechados**.

### 4. Subir
```bash
cd deploy/vps
docker compose up -d
docker compose ps          # os 5 serviços de pé (caddy/frontend/backend/postgres/watchtower)
```

As migrations rodam sozinhas no startup do backend (`run_migrations()`), então não
há passo manual de schema.

### 5. Validar
- `https://seudominio.com` carrega o Next.js.
- `https://seudominio.com/api/v1/version` responde do FastAPI com a versão da imagem.
- No DevTools → Network, as chamadas saem para **`/api/v1/...`** (same-origin), nunca
  para `localhost:8000`.
- `docker compose down && up -d` preserva os dados (volume `pgdata`).

### 6. Backup
Agende `backup.sh` no cron (ver cabeçalho do script).

## Pegadinhas

- **Nenhum serviço além do Caddy publica porta.** Isso é deliberado: numa VPS com IP
  público, um `ports: 5433:5432` no postgres é banco exposto pra internet. (O
  `docker-compose.prod.yml` da raiz faz isso — ele é pra uso local, não pra VPS.)
- **`ufw`/`iptables`:** abrir só no painel do provedor não basta. É a causa nº 1 de
  "o container sobe mas o site não abre".
- **Prefixo `/api`:** o FastAPI expõe `/api/v1/...`, então o Caddy usa `handle`
  (mantém o prefixo). Não troque por `handle_path` sem ajustar o `root_path`.
- **`depends_on` não espera o app**, só o container. O healthcheck do Postgres +
  `condition: service_healthy` cobre o backend.
- **A base da API é decidida no build, não aqui.** O Next inlina `NEXT_PUBLIC_API_BASE`
  no bundle; o CI publica a imagem com o valor vazio (same-origin) desde o #189.
  Imagens `0.3.x` e qualquer `0.4` anterior ao #189 têm `localhost:8000` assado dentro
  e **não funcionam atrás de proxy**.
- **A linha 0.3 não é deployável.** Lá o `API_BASE` é hardcoded no `lib/api.ts` — o
  same-origin só existe do master (0.4) pra frente.
