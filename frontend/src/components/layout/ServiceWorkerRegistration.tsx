"use client";
import { useEffect } from "react";

import { APP_VERSION } from "@/lib/version";

/**
 * Registra o service worker (#321).
 *
 * Não renderiza nada — monta no layout raiz só para ter um `useEffect` do lado
 * do cliente. Todo o corpo é defensivo: isto roda em TODA página, e uma
 * exceção aqui derrubaria a árvore inteira do React.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Em dev o SW serviria chunk do cache por cima do HMR do Turbopack, e a
    // tela pararia de refletir o código sem motivo visível. O ganho (abrir
    // offline) só existe em produção mesmo.
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // A versão vai na QUERY, não no conteúdo do arquivo: o navegador decide
    // atualizar o SW comparando o script byte a byte, e um `sw.js` estático
    // seria idêntico depois de todo deploy. Mudando a URL, ele busca de novo —
    // e o `sw.js` lê esse mesmo `v` para nomear o cache, então cada versão tem
    // o seu e o `activate` apaga os anteriores.
    navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`).catch((erro) => {
      // Falha de registro não é fatal: o app funciona igual, só sem offline.
      // Silenciar por completo esconderia SecurityError de origem sem HTTPS,
      // que é a causa mais comum e a mais difícil de adivinhar (#308).
      console.warn("service worker não registrado:", erro);
    });
  }, []);

  return null;
}
