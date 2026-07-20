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
| `docker-compose.yml` | Stack completa (imagens do GHCR). **Padrão: Variante B** (nenhuma porta publicada) |
| `Caddyfile.tunnel` | Variante B (Cloudflare Tunnel, HTTP interno) — **o mount padrão** |
| `Caddyfile` | Variante A (Origin Certificate + TLS) |
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

**Variante B — Cloudflare Tunnel** (padrão do compose, mais segura, nenhuma porta aberta):
1. **Zero Trust → Networks → Tunnels**: crie o túnel, copie o **token** →
   `TUNNEL_TOKEN` no `.env`.
2. **Public Hostname** do túnel → serviço **`http://caddy:80`** (é o Caddy que roteia
   `/api` e `/`; nunca aponte pro frontend `:3000` nem pro IP da VPS).
3. **DNS**: o túnel cria o **CNAME `<tunnel-id>.cfargotunnel.com`** (proxied) sozinho.
   **Não** deixe um registro **A pro IP da VPS** no mesmo host — ele faz o Cloudflare
   ir direto na origem e devolver **521** (ver *Pegadinhas*). 80/443 ficam **fechados**.
4. No compose **não há o que editar**: já vem com `cloudflared` ativo, `Caddyfile.tunnel`
   montado e sem `ports:` no caddy.

**Variante A — proxy laranja + Origin Certificate** (alternativa; exige editar o compose):
1. Cloudflare → **SSL/TLS → Origin Server → Create Certificate**. Salve como
   `deploy/vps/certs/origin.pem` e `origin.key` na VPS.
2. **SSL/TLS → Overview**: modo **Full (strict)**.
3. **DNS**: registro **A** → IP público da VPS, **proxy ligado** (nuvem laranja).
4. **Firewall** (crucial): libere 80/443 **só** das faixas do Cloudflare
   (`https://www.cloudflare.com/ips/`) — no firewall do provedor **e** no
   `iptables`/`ufw` da VPS. Sem isso, quem descobrir o IP contorna o Cloudflare.
5. No `docker-compose.yml` (serviço `caddy`): descomente o bloco `ports:` e o volume
   `./certs`, troque o mount para `./Caddyfile`, e comente o serviço `cloudflared`.

### 4. Subir
```bash
cd deploy/vps
docker compose up -d
docker compose ps          # Variante B: 6 serviços (postgres/backend/frontend/caddy/watchtower/cloudflared); Variante A: 5 (sem cloudflared)
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
  "o container sobe mas o site não abre". (Só na Variante A — na B nada é aberto.)
- **Variante B — `error 521` = DNS apontando pro IP, não pro túnel.** No túnel, o DNS
  do domínio tem que ser o **CNAME `<tunnel-id>.cfargotunnel.com`** (proxied). Se
  sobrar um registro **A → IP da VPS**, o Cloudflare vai **direto na 443 da VPS** —
  que não escuta nada na Variante B — e devolve **521 "web server is down"** (com
  `server: cloudflare` + `cf-ray`, ou seja, a borda foi alcançada mas a origem não).
  Corrija na aba **DNS → Records**: apague o A/AAAA do host e salve o Public Hostname
  de novo pra ele criar o CNAME (o Cloudflare **não** cria o CNAME enquanto existir
  A/AAAA no mesmo nome — dá "record with that host already exists"). O **MX e TXT de
  e-mail podem ficar**: o CNAME flattening no apex os deixa coexistir com o do túnel.
- **Variante B — o Public Hostname aponta pro `http://caddy:80`.** É o Caddy que
  roteia `/api/* → backend` e `/* → frontend`; mandar o túnel direto pro frontend
  (`:3000`) ou pro IP da VPS pula o Caddy e quebra o `/api`. O `cloudflared` fala com
  o Caddy pelo **nome do serviço** na rede interna, nunca por IP público.
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
