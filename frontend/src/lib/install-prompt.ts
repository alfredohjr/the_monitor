// Convite de instalação do PWA (#323).
//
// A decisão e as leituras de ambiente ficam aqui, fora do componente, porque
// cada uma tem uma armadilha própria: `matchMedia` não existe em todo lugar, o
// iOS não implementa `display-mode`, e a dispensa precisa sobreviver à visita.

const CHAVE_DISPENSA = "pwa-install-dismissed";

export type ContextoConvite = {
  /** O navegador disparou `beforeinstallprompt`. */
  eventoCapturado: boolean;
  jaInstalado: boolean;
  dispensado: boolean;
};

/**
 * Mostra o convite?
 *
 * Sem o evento não há o que chamar no clique — o banner seria um botão morto.
 * Os outros dois "não" são de respeito: ninguém quer instalar o que já tem, nem
 * ver de novo o que acabou de recusar.
 */
export function deveMostrarConvite(ctx: ContextoConvite): boolean {
  return ctx.eventoCapturado && !ctx.jaInstalado && !ctx.dispensado;
}

/** O app está rodando instalado, e não numa aba do navegador? */
export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;

  // O Safari não implementa a media query `display-mode` — ele expõe
  // `navigator.standalone`. Só olhar a media query daria "não instalado" para
  // todo iPhone com o app na tela inicial.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  if (iosStandalone) return true;

  // `matchMedia` não existe no jsdom nem em navegadores antigos. Chamar direto
  // lança TypeError e derruba o componente, que monta no layout raiz.
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Script inline do layout, que roda antes da hidratação.
 *
 * O Chrome dispara `beforeinstallprompt` no carregamento, em geral antes de o
 * React montar qualquer coisa. Quem escuta só no `useEffect` perde o evento — e
 * o sintoma é o banner nunca aparecer, sem nada no console.
 *
 * Mora aqui, e não solto dentro do JSX, para o teste poder executá-lo de
 * verdade em vez de conferir se a string existe no arquivo.
 */
export const SCRIPT_CAPTURA_INSTALL =
  "(function(){window.__pwaInstallEvent=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallEvent=e;});})();";

export function foiDispensado(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CHAVE_DISPENSA) === "true";
}

export function marcarDispensado(): void {
  if (typeof window !== "undefined") localStorage.setItem(CHAVE_DISPENSA, "true");
}
