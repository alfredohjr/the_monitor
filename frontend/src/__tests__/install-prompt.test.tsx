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

