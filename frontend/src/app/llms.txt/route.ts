import { localeDeAcceptLanguage, type Locale } from "@/lib/i18n";

// As ROTAS são idênticas nos dois idiomas de propósito: são identificadores, não
// texto. Há teste conferindo que as duas versões listam exatamente as mesmas —
// se divergirem, uma delas passa a documentar URLs que não existem.
const CONTENT: Record<Locale, string> = {
  en: `# The Monitor

> Platform for tracking metrics and personal goals.

## What it is

The Monitor is a web application to record metrics (indicators), set goals and follow daily progress with entries and a visual dashboard.

## Public pages

- \`/\` — Home page
- \`/login\` — Sign in (username/password or Google)
- \`/register\` — New user sign-up

## Features (require authentication)

- \`/dashboard\` — Dashboard with weekly progress charts and goal success rate
- \`/goals\` — Management of goals linked to metrics
- \`/logs\` — Daily entry records
- \`/metrics\` — Metric setup and configuration
- \`/simulation\` — Future scenario simulation

## About

Built by Alfredo Holz Junior.
Stack: Next.js 15 (frontend) + FastAPI (backend) + PostgreSQL.
`,
  "pt-BR": `# The Monitor

> Plataforma de acompanhamento de métricas e metas pessoais.

## O que é

The Monitor é uma aplicação web para registrar métricas (indicadores), definir metas e acompanhar o progresso diário com logs e dashboard visual.

## Páginas públicas

- \`/\` — Página inicial
- \`/login\` — Login (usuário/senha ou Google)
- \`/register\` — Cadastro de novo usuário

## Funcionalidades (requerem autenticação)

- \`/dashboard\` — Dashboard com gráficos de evolução semanal e taxa de sucesso
- \`/goals\` — Gerenciamento de metas vinculadas a métricas
- \`/logs\` — Registro de lançamentos diários
- \`/metrics\` — Cadastro e configuração de métricas
- \`/simulation\` — Simulação de cenários futuros

## Sobre

Desenvolvido por Alfredo Holz Junior.
Stack: Next.js 15 (frontend) + FastAPI (backend) + PostgreSQL.
`,
};

export function GET(request?: Request) {
  // Roda no servidor: não há localStorage, então o idioma vem do header da
  // requisição — o mesmo critério que o backend usa (#299).
  const locale = localeDeAcceptLanguage(request?.headers.get("accept-language"));
  return new Response(CONTENT[locale], {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Sinaliza a proxies e CDNs que a resposta varia por idioma. Sem isto, o
      // primeiro visitante fixaria o idioma em cache para todos os seguintes.
      vary: "Accept-Language",
    },
  });
}
