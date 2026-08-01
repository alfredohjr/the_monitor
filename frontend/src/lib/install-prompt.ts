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

export type ContextoIOS = {
  ehSafariIOS: boolean;
  jaInstalado: boolean;
  dispensado: boolean;
};

/**
 * Mostra a instrução manual do iPhone? (#324)
 *
 * O iOS não implementa `beforeinstallprompt` — não existe instalação
 * programática, e a única via é *Compartilhar → Adicionar à Tela de Início* no
 * Safari. Sem instrução explícita, praticamente ninguém instala pelo iPhone.
 *
 * Também é pré-requisito do Web Push no iOS, que só funciona com o app na tela
 * inicial e nunca numa aba do Safari.
 */
export function deveMostrarInstrucaoIOS(ctx: ContextoIOS): boolean {
  return ctx.ehSafariIOS && !ctx.jaInstalado && !ctx.dispensado;
}

/**
 * É Safari rodando em iOS/iPadOS?
 *
 * Três armadilhas, e cada uma tem um teste:
 *
 * 1. **iPad se anuncia como Macintosh** desde o iPadOS 13. O que o separa de um
 *    Mac é `maxTouchPoints`.
 * 2. **Chrome e Firefox no iOS terminam o UA em "Safari/604.1"**, mas não têm o
 *    item "Adicionar à Tela de Início" — mostrar a instrução ali ensina um
 *    gesto que não existe naquele app.
 * 3. **Chrome no Android traz "Mobile Safari/537.36"**, e casar só por "Safari"
 *    faria a instrução de iPhone aparecer no Android.
 */
export function ehSafariIOS(userAgent: string, maxTouchPoints: number): boolean {
  const ehIOS = /iPad|iPhone|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1);
  if (!ehIOS) return false;

  // Navegadores de terceiros no iOS se identificam por um sufixo próprio.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(userAgent)) return false;

  return userAgent.includes("Safari");
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
