/**
 * Decisão de mostrar o convite de instalação (#323).
 *
 * A regra é pequena, mas cada "não" dela corresponde a um jeito de irritar o
 * usuário: oferecer instalação de um app já instalado, ou reaparecer depois de
 * dispensado. Fica separada da renderização para poder ser lida de uma vez.
 */
import {
  deveMostrarConvite,
  estaInstalado,
  foiDispensado,
  marcarDispensado,
} from "@/lib/install-prompt";

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
