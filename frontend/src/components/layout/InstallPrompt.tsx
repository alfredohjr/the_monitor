"use client";
import { useEffect, useState } from "react";

import { deveMostrarConvite, estaInstalado, foiDispensado, marcarDispensado } from "@/lib/install-prompt";
import { useT } from "@/lib/i18n/useT";

/** O `beforeinstallprompt`, que ainda não está nos tipos padrão do DOM. */
type EventoDeInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

type JanelaComEvento = Window & { __pwaInstallEvent?: EventoDeInstalacao | null };

/**
 * Banner de "instalar app" no Chrome/Android (#323).
 *
 * O evento `beforeinstallprompt` dispara logo no carregamento, em geral ANTES
 * de o React hidratar. Por isso quem o captura primeiro é um script no layout,
 * que o guarda em `window.__pwaInstallEvent`; aqui nós o recolhemos na montagem
 * e também escutamos, para o caso de ele chegar depois.
 *
 * Sem essa dupla, o banner simplesmente nunca aparece — e sem erro no console,
 * o que torna o problema difícil de enxergar.
 */
export default function InstallPrompt() {
  const { t } = useT();
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const janela = window as JanelaComEvento;

    const considerar = (e: EventoDeInstalacao) => {
      setEvento(e);
      setVisivel(deveMostrarConvite({ eventoCapturado: true, jaInstalado: estaInstalado(), dispensado: foiDispensado() }));
    };

    if (janela.__pwaInstallEvent) considerar(janela.__pwaInstallEvent);

    const aoOferecer = (e: Event) => {
      // Sem o preventDefault, o Chrome mostra o próprio banner por cima.
      e.preventDefault();
      considerar(e as EventoDeInstalacao);
    };
    const aoInstalar = () => {
      // Instalou por outro caminho (menu do navegador): o convite perde sentido.
      setVisivel(false);
      marcarDispensado();
    };

    window.addEventListener("beforeinstallprompt", aoOferecer);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoOferecer);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (!visivel || !evento) return null;

  const instalar = () => {
    // O evento só pode ser usado UMA vez: depois do prompt ele está gasto, e
    // guardá-lo levaria a um segundo clique que não faz nada.
    setVisivel(false);
    const usado = evento;
    setEvento(null);
    (window as JanelaComEvento).__pwaInstallEvent = null;
    usado.prompt().catch(() => {});
  };

  const dispensar = () => {
    marcarDispensado();
    setVisivel(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl glass border border-zinc-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 shadow-2xl">
        <p className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{t("pwa.installMessage")}</p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={dispensar}
            className="px-4 py-3 rounded-full font-medium text-sm text-zinc-500 hover:text-zinc-300 transition"
          >
            {t("pwa.installDismiss")}
          </button>
          <button
            onClick={instalar}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-medium text-sm text-white whitespace-nowrap transition"
          >
            {t("pwa.installAction")}
          </button>
        </div>
      </div>
    </div>
  );
}
