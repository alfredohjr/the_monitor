# the_monitor — Landing Page

Landing page (página de vendas) do the_monitor, **desvinculada** do app principal
(issue #37). Projeto Next.js independente.

## Rodando

```bash
cd landing
npm install
npm run dev   # http://localhost:3002
```

## Configuração

Os CTAs apontam para o app principal via `NEXT_PUBLIC_APP_URL` (veja `.env.example`).
Padrão: `http://localhost:3000`.
