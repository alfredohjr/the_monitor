"use client";
import { useLocaleTolerante } from "@/lib/i18n/I18nProvider";
import { useT } from "@/lib/i18n/useT";

// Seletor de idioma (#279). Espelha a forma do ThemeToggle: um botão só, que
// mostra o destino da troca (em "en" ele oferece "PT"), com aria-label descrevendo
// a ação. São dois idiomas — um <select> seria peso morto.
export default function LocaleToggle() {
  const { locale, setLocale } = useLocaleTolerante();
  const { t } = useT();

  const vaiParaPortugues = locale === "en";

  return (
    <button
      onClick={() => setLocale(vaiParaPortugues ? "pt-BR" : "en")}
      aria-label={t(vaiParaPortugues ? "navbar.switchToPortuguese" : "navbar.switchToEnglish")}
      title={t(vaiParaPortugues ? "navbar.switchToPortuguese" : "navbar.switchToEnglish")}
      className="text-xs font-bold tracking-wide text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition"
    >
      {vaiParaPortugues ? "PT" : "EN"}
    </button>
  );
}
