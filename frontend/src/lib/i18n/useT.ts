"use client";
import { useEffect, useState } from "react";
import { getInitialLocale, t as traduzirChave, LOCALE_PADRAO, type Locale } from ".";

/**
 * Hook de tradução para componentes de cliente.
 *
 * O locale mora no localStorage, que não existe no servidor: o primeiro render
 * sai no padrão (`en`) e o `useEffect` corrige no cliente — mesmo caminho que o
 * `ThemeToggle` já usa, e que evita mismatch de hidratação.
 *
 * Enquanto não existe o provider (#278), a troca de idioma só se reflete nos
 * componentes montados depois dela. O #278 substitui o miolo por context e o
 * re-render passa a ser imediato, sem mudar esta assinatura.
 */
export function useT(): { t: (chave: string) => string; locale: Locale } {
  const [locale, setLocaleState] = useState<Locale>(LOCALE_PADRAO);

  useEffect(() => {
    setLocaleState(getInitialLocale());
  }, []);

  return {
    locale,
    t: (chave: string) => traduzirChave(chave, locale),
  };
}
