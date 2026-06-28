const CONTENT = `# The Monitor

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
- \`/simulacao\` — Simulação de cenários futuros

## Sobre

Desenvolvido por Alfredo Holz Junior.
Stack: Next.js 15 (frontend) + FastAPI (backend) + PostgreSQL.
`;

export function GET() {
  return new Response(CONTENT, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
