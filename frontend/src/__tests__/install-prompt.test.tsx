/**
 * Banner de convite de instalação (#323).
 *
 * O caso que mais importa aqui é o do evento que chega ANTES da montagem: o
 * Chrome dispara `beforeinstallprompt` logo no carregamento, muitas vezes antes
 * do React hidratar. Um componente que só escuta no `useEffect` perde o evento
 * e o banner nunca aparece — sem erro nenhum no console.
 */
import fs from "fs";
import path from "path";

import { act, fireEvent, render, screen } from "@testing-library/react";

import InstallPrompt from "@/components/layout/InstallPrompt";
import { SCRIPT_CAPTURA_INSTALL } from "@/lib/install-prompt";

type EventoFalso = Event & { prompt: jest.Mock; userChoice: Promise<{ outcome: string }> };

function eventoDeInstalacao(outcome = "accepted"): EventoFalso {
  const e = new Event("beforeinstallprompt") as EventoFalso;
  e.prompt = jest.fn().mockResolvedValue(undefined);
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

function dispararEvento(e: Event) {
  act(() => {
    window.dispatchEvent(e);
  });
}

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as never;
});

afterEach(() => {
  localStorage.clear();
  delete (window as { __pwaInstallEvent?: unknown }).__pwaInstallEvent;
});

describe("InstallPrompt", () => {
  it("não mostra nada enquanto o navegador não oferece a instalação", () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("aparece quando o evento chega depois da montagem", async () => {
    render(<InstallPrompt />);
    dispararEvento(eventoDeInstalacao());

    expect(await screen.findByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("aparece quando o evento chegou ANTES da montagem", async () => {
    // É o caso real no Chrome: o script do layout guarda o evento em
    // window.__pwaInstallEvent, e o componente o encontra ao montar.
    (window as { __pwaInstallEvent?: unknown }).__pwaInstallEvent = eventoDeInstalacao();

    render(<InstallPrompt />);

    expect(await screen.findByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("instalar chama o prompt do navegador", async () => {
    const evento = eventoDeInstalacao();
    render(<InstallPrompt />);
    dispararEvento(evento);

    fireEvent.click(await screen.findByRole("button", { name: "Install" }));

    expect(evento.prompt).toHaveBeenCalled();
  });

  it("some depois de dispensar, e não volta na visita seguinte", async () => {
    render(<InstallPrompt />);
    dispararEvento(eventoDeInstalacao());

    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();

    // Nova visita: monta de novo, com o evento disponível outra vez.
    const segunda = render(<InstallPrompt />);
    dispararEvento(eventoDeInstalacao());
    expect(segunda.container).toBeEmptyDOMElement();
  });

  it("não aparece com o app já aberto instalado", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as never;

    const { container } = render(<InstallPrompt />);
    dispararEvento(eventoDeInstalacao());

    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza em pt-BR", async () => {
    localStorage.setItem("locale", "pt-BR");
    render(<InstallPrompt />);
    dispararEvento(eventoDeInstalacao());

    expect(await screen.findByRole("button", { name: "Instalar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agora não" })).toBeInTheDocument();
  });
});

describe("InstallPrompt no iOS (#324)", () => {
  const UA_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1";

  function fingirIPhone(ua = UA_IPHONE) {
    Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
  }

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/20",
      configurable: true,
    });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
  });

  it("mostra a instrução manual, sem botão de instalar", async () => {
    fingirIPhone();
    render(<InstallPrompt />);

    // A frase precisa citar o rótulo exato do menu do iOS: é o que o usuário
    // vai procurar na tela dele.
    expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument();
    // Não existe instalação programática no iOS — um botão "Install" aqui seria
    // uma promessa que nada cumpre.
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("some depois de dispensada e não volta", async () => {
    fingirIPhone();
    render(<InstallPrompt />);

    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();

    const segunda = render(<InstallPrompt />);
    expect(segunda.container).toBeEmptyDOMElement();
  });

  it("não aparece com o app já na tela inicial", () => {
    fingirIPhone();
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as never;

    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não aparece no Chrome do iOS, que não tem esse item de menu", () => {
    fingirIPhone(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1"
    );

    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza em pt-BR com o rótulo que o iOS em português mostra", async () => {
    fingirIPhone();
    localStorage.setItem("locale", "pt-BR");
    render(<InstallPrompt />);

    expect(await screen.findByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
  });

  it("o Android segue no ramo do evento, sem instrução de iPhone", async () => {
    // Guarda contra regressão da #323: o UA do Chrome no Android também contém
    // "Safari".
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      configurable: true,
    });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });

    render(<InstallPrompt />);
    dispararEvento(eventoDeInstalacao());

    expect(await screen.findByRole("button", { name: "Install" })).toBeInTheDocument();
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();
  });
});

describe("captura antes da hidratação", () => {
  it("o script guarda o evento em window.__pwaInstallEvent", () => {
    // Executa o script REAL que vai para o HTML. Sem este teste, o caminho
    // "evento chegou antes da montagem" do componente seria código morto em
    // produção e nenhum teste notaria.
    eval(SCRIPT_CAPTURA_INSTALL);

    const e = eventoDeInstalacao();
    window.dispatchEvent(e);

    expect((window as { __pwaInstallEvent?: unknown }).__pwaInstallEvent).toBe(e);
  });

  it("o layout monta o script e o banner", () => {
    const layout = fs.readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf8");
    expect(layout).toContain("SCRIPT_CAPTURA_INSTALL");
    expect(layout).toContain("<InstallPrompt />");
  });
});

