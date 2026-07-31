import type { MetadataRoute } from "next";

import { t } from "@/lib/i18n";

/**
 * Manifest do app instalável (#319).
 *
 * Rota de metadata do Next, e não um `public/manifest.json` estático: as
 * strings vêm do catálogo de i18n, e um JSON fixo engessaria `name` e
 * `description` no idioma em que foram escritos.
 *
 * Estático no idioma padrão, pela mesma razão do #314: ler `Accept-Language`
 * aqui exigiria `headers()`, e o custo de tornar a rota dinâmica não se paga
 * por um arquivo que o navegador busca uma vez na instalação.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t("pwa.name"),
    short_name: t("pwa.shortName"),
    description: t("pwa.description"),
    // `standalone` tira a barra do navegador — é o que faz parecer app.
    display: "standalone",
    // /dashboard já é rota em inglês e sobreviveu à renomeação das #311-#313.
    // A raiz redireciona para o login quando não há sessão, então abrir o app
    // instalado direto no painel é o caminho mais curto para quem já entrou.
    start_url: "/dashboard",
    scope: "/",
    // Alinhadas ao tema escuro, que é o default do layout: a splash do Android
    // usa background_color, e uma cor clara aqui daria um flash branco antes da
    // tela escura carregar.
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Sem um maskable o Android recorta o ícone num círculo e come as bordas.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
