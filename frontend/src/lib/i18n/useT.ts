"use client";
import { useCallback, useEffect, useState } from "react";
import { getInitialLocale, t as traduzirChave, LOCALE_PADRAO, type Locale } from ".";
import { useI18nOpcional } from "./I18nProvider";

/**
 * Hook de tradução para componentes de cliente.
 *
 * Sob o `I18nProvider` (#278), o locale vem do context e trocar o idioma
 * re-renderiza os consumidores já montados na hora.
 *
 * Fora do provider, cai no comportamento do #277: lê o localStorage na montagem.
 * Isso existe porque durante a migração das telas nem todo componente está sob o
 * provider — e as duas fontes concordam, já que ambas leem o mesmo storage.
 */
export function useT(): { t: (chave: string) => string; locale: Locale } {
  const ctx = useI18nOpcional();

  // Chamado incondicionalmente (regra dos hooks); só é usado fora do provider.
  const [localeSolto, setLocaleSolto] = useState<Locale>(LOCALE_PADRAO);
  useEffect(() => {
    setLocaleSolto(getInitialLocale());
  }, []);

  const locale = ctx?.locale ?? localeSolto;

  // Memoizado por locale: um `t` novo a cada render entra em dep array de
  // useCallback/useEffect dos componentes e faz o efeito reexecutar sempre.
  // Na tela de login isso injetava um <script> do Google a cada render (#282).
  const t = useCallback((chave: string) => traduzirChave(chave, locale), [locale]);

  return { locale, t };
}
