"use client";
import { useT } from "@/lib/i18n/useT";

/**
 * Tela de sem conexão (#322).
 *
 * O service worker responde esta rota quando a navegação falha e a página
 * pedida não está em cache. Duas regras que parecem detalhe e não são:
 *
 * - **Pública.** Exigir token mandaria para o /login quem só está sem internet
 *   — e o /login também não carregaria.
 * - **Sem requisição.** Qualquer chamada aqui falharia exatamente na situação
 *   para a qual esta tela existe.
 *
 * Por isso ela é estática e o conteúdo todo vem do catálogo, sem estado.
 */
export default function OfflinePage() {
  const { t } = useT();

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-zinc-50 dark:bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-md bg-white border border-zinc-200 dark:bg-white/[0.03] dark:glass dark:border-white/5 p-10 rounded-3xl text-center">
        <div aria-hidden className="text-4xl mb-4">
          {/* Emoji em vez de ícone de arquivo: um <img> aqui dependeria de o
              precache ter guardado justamente aquele arquivo. */}
          📡
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">{t("pwa.offlineTitle")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">{t("pwa.offlineMessage")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition"
        >
          {t("pwa.offlineRetry")}
        </button>
      </div>
    </div>
  );
}
