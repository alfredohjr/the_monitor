import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rotas renomeadas para inglês (#311). As antigas seguem funcionando por
  // redirect PERMANENTE: bookmark de usuário atual e link já compartilhado não
  // podem virar 404, e o 308 ensina o destino novo ao navegador e aos buscadores.
  async redirects() {
    return [
      { source: "/perfil", destination: "/profile", permanent: true },
      { source: "/notificacoes", destination: "/notifications", permanent: true },
      { source: "/simulacao", destination: "/simulation", permanent: true },
      // As LISTAS já eram /goals e /logs; só as sub-rotas tinham ficado em
      // português (#312). Unifica o prefixo em vez de manter a tela dividida.
      { source: "/metas/importar", destination: "/goals/import", permanent: true },
      { source: "/metas/ancorar", destination: "/goals/anchor", permanent: true },
      { source: "/metas/clonar", destination: "/goals/clone", permanent: true },
      { source: "/lancamentos/importar", destination: "/logs/import", permanent: true },
    ];
  },
  eslint: {
    // ESLint runs in CI — skip during Docker build to avoid blocking on warnings
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
