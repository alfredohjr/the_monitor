# Deploy — Oracle Cloud (Always Free) + Cloudflare (#162)

Sobe Next.js + FastAPI + PostgreSQL numa única VM ARM (`VM.Standard.A1.Flex`, tier
Always Free), com **Caddy** de reverse proxy interno e **Cloudflare** na frente
(proxy/WAF/DDoS, esconde o IP da VM).

```
Visitante ──HTTPS──> Cloudflare ──HTTPS──> Caddy (VM)
                                            ├── /api/*  -> backend  (FastAPI :8000)
                                            └── /*      -> frontend (Next.js :3000)
                                                            backend -> postgres :5432
```

## ⚠️ Blocker conhecido antes de ir pra produção

O **frontend hoje hardcoda `http://localhost:8000`** nas chamadas de API (55
ocorrências em ~22 arquivos, ex.: `src/lib/api.ts`, `LogList`, `AdminUsers`).
Servido por um domínio real, o browser vai tentar bater em `localhost:8000` do
**visitante** e falhar — o roteamento `/api/*` do Caddy só funciona se o front
chamar a API na **mesma origem** (`/api/v1/...`).

**É preciso, antes (ou junto), tornar a base da API configurável / same-origin**
(ex.: `API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"` e
trocar as URLs absolutas por relativas `/api/v1/...`). Isso é um refactor de
frontend à parte — recomendado abrir uma issue dedicada. Os artefatos deste
diretório já assumem o roteamento `/api` pronto pra quando esse ajuste existir.

## Arquivos deste diretório

| Arquivo | O quê |
|---|---|
| `docker-compose.yml` | Stack completa (build local ARM), só o Caddy exposto |
| `Caddyfile` | Variante A (Origin Certificate + TLS) |
| `Caddyfile.tunnel` | Variante B (Cloudflare Tunnel, HTTP interno) |
| `.env.example` | Modelo do `.env` (copie e preencha) |
| `backup.sh` | `pg_dump` agendável com retenção |

> **Build local (ARM):** as imagens do GHCR (#146) são **amd64** e não rodam
> nativo na VM ARM. Por isso o compose usa `build:`. (Alternativa futura: fazer a
> `release.yml` publicar multi-arch `linux/amd64,linux/arm64`.)

## Passo a passo

### 1. VM na Oracle
- Criar instância `VM.Standard.A1.Flex` (Ubuntu, *Always Free eligible*).
- SSH na VM; instalar Docker Engine + plugin `docker compose`.

### 2. Código e config
```bash
git clone <repo> && cd numeroUm
cp deploy/oracle/.env.example deploy/oracle/.env   # preencha os valores
```

### 3. Cloudflare — escolha a variante

**Variante A — proxy laranja + Origin Certificate** (mais simples de operar):
1. Cloudflare → **SSL/TLS → Origin Server → Create Certificate**. Salve como
   `deploy/oracle/certs/origin.pem` e `origin.key` na VM.
2. **SSL/TLS → Overview**: modo **Full (strict)**.
3. **DNS**: registro **A** → IP público da VM, **proxy ligado** (nuvem laranja).
4. **Firewall** (crucial): libere 80/443 **só** das faixas do Cloudflare
   (`https://www.cloudflare.com/ips/`) — na *Security List/NSG* da Oracle **e** no
   `iptables` da VM. Sem isso, quem descobrir o IP contorna o Cloudflare.

**Variante B — Cloudflare Tunnel** (mais segura, nenhuma porta aberta):
1. **Zero Trust → Networks → Tunnels**: crie o túnel, copie o **token** →
   `TUNNEL_TOKEN` no `.env`.
2. Public hostname do túnel → `http://caddy:80`.
3. No compose: descomente `cloudflared`, **remova o bloco `ports:` do caddy**, e
   troque o Caddyfile pelo `Caddyfile.tunnel`.
4. DNS é criado pelo próprio túnel; 80/443 podem ficar **fechados**.

### 4. Subir
```bash
cd deploy/oracle
docker compose up -d --build
docker compose ps          # os 4 serviços de pé (caddy/frontend/backend/postgres)
```

### 5. Validar
- `https://seudominio.com` carrega o Next.js.
- `https://seudominio.com/api/v1/...` responde do FastAPI. *(depende do blocker acima)*
- `docker compose down && up -d` preserva os dados (volume `pgdata`).

### 6. Backup
Agende `backup.sh` no cron (ver cabeçalho do script).

## Pegadinhas
- **iptables da Oracle:** o Ubuntu vem com regras restritivas. Abrir só na
  Security List **não basta** — libere também no `iptables` da VM. É a causa nº 1
  de "o container sobe mas o site não abre".
- **Prefixo `/api`:** o FastAPI expõe `/api/v1/...`, então o Caddy usa `handle`
  (mantém o prefixo). Não troque por `handle_path` sem ajustar o `root_path`.
- **`depends_on` não espera o app**, só o container. O healthcheck do Postgres +
  `condition: service_healthy` cobre o backend; o ORM ainda deve ter retry.
- **Conta Oracle:** a verificação de cartão às vezes trava — persista/tente outra bandeira.
