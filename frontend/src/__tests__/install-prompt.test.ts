/**
 * Decisão de mostrar o convite de instalação (#323).
 *
 * A regra é pequena, mas cada "não" dela corresponde a um jeito de irritar o
 * usuário: oferecer instalação de um app já instalado, ou reaparecer depois de
 * dispensado. Fica separada da renderização para poder ser lida de uma vez.
 */
import {
  deveMostrarConvite,
  deveMostrarInstrucaoIOS,
  ehSafariIOS,
  estaInstalado,
  foiDispensado,
  marcarDispensado,
} from "@/lib/install-prompt";

// User agents reais. Escritos por extenso de propósito: a detecção de iOS é
// cheia de casos que só um UA verdadeiro revela, e uma string inventada aqui
// daria confiança falsa.
const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  // Desde o iPadOS 13 o iPad se anuncia como Macintosh. O que o distingue de um
  // Mac de verdade é a tela sensível ao toque.
  ipadSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  chromeIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
  firefoxIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
};

const ELEGIVEL = { eventoCapturado: true, jaInstalado: false, dispensado: false };

describe("deveMostrarConvite", () => {
  it("mostra quando o navegador ofereceu a instalação e nada impede", () => {
    expect(deveMostrarConvite(ELEGIVEL)).toBe(true);
  });

  it("não mostra sem o evento do navegador", () => {
    // Sem `beforeinstallprompt` não há o que chamar no clique: o banner seria
    // um botão que não faz nada.
    expect(deveMostrarConvite({ ...ELEGIVEL, eventoCapturado: false })).toBe(false);
  });

  it("não mostra com o app já instalado", () => {
    expect(deveMostrarConvite({ ...ELEGIVEL, jaInstalado: true })).toBe(false);
  });

  it("não mostra depois de dispensado", () => {
    expect(deveMostrarConvite({ ...ELEGIVEL, dispensado: true })).toBe(false);
  });
});

describe("ehSafariIOS", () => {
  it("reconhece o Safari no iPhone", () => {
    expect(ehSafariIOS(UA.iphoneSafari, 5)).toBe(true);
  });

  it("reconhece o iPad, que se anuncia como Macintosh", () => {
    // Desde o iPadOS 13 o UA do iPad é idêntico ao de um Mac. Sem olhar o toque,
    // nenhum usuário de iPad veria a instrução.
    expect(ehSafariIOS(UA.ipadSafari, 5)).toBe(true);
  });

  it("não confunde um Mac com um iPad", () => {
    // Mesmo UA do caso acima, sem tela sensível ao toque. No desktop a
    // instrução seria um absurdo: não existe tela inicial.
    expect(ehSafariIOS(UA.macSafari, 0)).toBe(false);
  });

  it("não trata Chrome no iOS como Safari", () => {
    // O UA do Chrome no iPhone TERMINA em "Safari/604.1" — procurar "Safari" na
    // string acerta aqui e ensina um gesto que esse navegador não tem.
    expect(ehSafariIOS(UA.chromeIOS, 5)).toBe(false);
  });

  it("não trata Firefox no iOS como Safari", () => {
    expect(ehSafariIOS(UA.firefoxIOS, 5)).toBe(false);
  });

  it("não trata Chrome no Android como Safari", () => {
    // "Mobile Safari/537.36" também aparece aqui. Este é o caso que faria a
    // instrução de iPhone surgir num Android — e regrediria a #323.
    expect(ehSafariIOS(UA.chromeAndroid, 5)).toBe(false);
  });
});

describe("deveMostrarInstrucaoIOS", () => {
  const NO_IPHONE = { ehSafariIOS: true, jaInstalado: false, dispensado: false };

  it("mostra no Safari do iPhone, onde não existe evento de instalação", () => {
    expect(deveMostrarInstrucaoIOS(NO_IPHONE)).toBe(true);
  });

  it("não mostra com o app já na tela inicial", () => {
    expect(deveMostrarInstrucaoIOS({ ...NO_IPHONE, jaInstalado: true })).toBe(false);
  });

  it("não mostra depois de dispensada", () => {
    expect(deveMostrarInstrucaoIOS({ ...NO_IPHONE, dispensado: true })).toBe(false);
  });

  it("não mostra fora do Safari iOS", () => {
    expect(deveMostrarInstrucaoIOS({ ...NO_IPHONE, ehSafariIOS: false })).toBe(false);
  });
});

describe("estaInstalado", () => {
  afterEach(() => {
    // @ts-expect-error — devolvendo o jsdom ao estado original
    delete window.matchMedia;
    // @ts-expect-error — idem
    delete navigator.standalone;
  });

  it("reconhece o app aberto em modo standalone", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as never;
    expect(estaInstalado()).toBe(true);
  });

  it("reconhece o standalone do iOS, que não usa display-mode", () => {
    // O Safari não implementa a media query `display-mode` — ele expõe
    // `navigator.standalone`. Só olhar a media query daria "não instalado"
    // para todo iPhone com o app na tela inicial.
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as never;
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    expect(estaInstalado()).toBe(true);
  });

  it("diz que não está instalado numa aba comum", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as never;
    expect(estaInstalado()).toBe(false);
  });

  it("não quebra onde matchMedia não existe", () => {
    // O jsdom não implementa matchMedia: chamá-lo direto lança TypeError e
    // derrubaria o componente inteiro, que monta no layout raiz.
    expect(() => estaInstalado()).not.toThrow();
    expect(estaInstalado()).toBe(false);
  });
});

describe("dispensa persistida", () => {
  afterEach(() => localStorage.clear());

  it("começa não dispensado", () => {
    expect(foiDispensado()).toBe(false);
  });

  it("sobrevive à visita seguinte", () => {
    // Reaparecer a cada visita é o jeito mais rápido de o usuário passar a
    // odiar o banner — e a desinstalar o app por causa dele.
    marcarDispensado();
    expect(foiDispensado()).toBe(true);
  });
});
