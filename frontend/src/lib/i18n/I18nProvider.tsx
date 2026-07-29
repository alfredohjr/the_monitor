"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getInitialLocale,
  applyLocale,
  setLocale as persistirLocale,
  LOCALE_PADRAO,
  type Locale,
} from ".";

type I18nContexto = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

// `null` como default é intencional: `useT` distingue "dentro do provider" de
// "fora" por essa marca. Durante a migração das telas (#280–#298) nem todo
// componente está sob o provider, e quebrar quem está fora quebraria as telas
// ainda não convertidas.
const I18nContext = createContext<I18nContexto | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Começa no padrão e corrige no efeito: o locale mora no localStorage, que não
  // existe no servidor. Mesmo caminho do tema — o <html lang> real é resolvido
  // antes da pintura pelo script anti-flash em `app/layout.tsx`.
  const [locale, setLocaleState] = useState<Locale>(LOCALE_PADRAO);

  useEffect(() => {
    const inicial = getInitialLocale();
    setLocaleState(inicial);
    applyLocale(inicial);
  }, []);

  const setLocale = useCallback((novo: Locale) => {
    setLocaleState(novo);
    persistirLocale(novo); // persiste + aplica no <html lang>
  }, []);

  return <I18nContext.Provider value={{ locale, setLocale }}>{children}</I18nContext.Provider>;
}

/** Locale ativo + troca. Só faz sentido sob o `I18nProvider`. */
export function useLocale(): I18nContexto {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useLocale precisa estar dentro de <I18nProvider>");
  }
  return ctx;
}

/** Contexto cru, sem lançar — `useT` usa isto para funcionar fora do provider. */
export function useI18nOpcional(): I18nContexto | null {
  return useContext(I18nContext);
}

/**
 * Como `useLocale`, mas funciona fora do provider — aí o estado é local e a troca
 * ainda persiste e aplica o `<html lang>`, só não propaga para outros componentes.
 *
 * Existe pelo mesmo motivo que o `useT` é tolerante: durante a migração das telas
 * (#280–#298) um componente pode ser montado solto, e explodir nesse caso quebra
 * quem ainda não foi convertido.
 */
export function useLocaleTolerante(): I18nContexto {
  const ctx = useContext(I18nContext);

  // Hooks chamados incondicionalmente; só usados quando não há provider.
  const [localeSolto, setLocaleSolto] = useState<Locale>(LOCALE_PADRAO);
  useEffect(() => {
    if (!ctx) setLocaleSolto(getInitialLocale());
  }, [ctx]);

  const setLocaleSoltoPersistindo = useCallback((novo: Locale) => {
    setLocaleSolto(novo);
    persistirLocale(novo);
  }, []);

  return ctx ?? { locale: localeSolto, setLocale: setLocaleSoltoPersistindo };
}
