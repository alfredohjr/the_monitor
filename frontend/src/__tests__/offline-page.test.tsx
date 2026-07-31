/**
 * Tela de sem conexão (#322).
 *
 * É a única tela do app que o usuário vê justamente quando nada funciona —
 * então ela não pode depender de rede, de token nem de dado carregado. Os
 * testes fixam isso: renderiza nos dois idiomas e o botão só recarrega.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import OfflinePage from "@/app/offline/page";

// O locale mora no localStorage, que sobrevive entre testes do mesmo arquivo:
// sem isto, o teste de pt-BR contamina os seguintes e eles falham procurando
// texto em inglês numa tela em português.
afterEach(() => localStorage.clear());

describe("tela offline", () => {
  it("explica a situação e oferece tentar de novo (inglês, padrão)", () => {
    render(<OfflinePage />);

    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renderiza em pt-BR quando o idioma está escolhido", () => {
    // O par EN/pt-BR é obrigatório: só o lado inglês deixaria passar "esqueci
    // de traduzir", e só o lado português passaria pelo motivo errado, já que
    // o texto original nasceria em português.
    localStorage.setItem("locale", "pt-BR");
    render(<OfflinePage />);

    expect(screen.getByText("Você está sem conexão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("o botão recarrega a página", () => {
    const reload = jest.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(<OfflinePage />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // Recarregar é o certo aqui, e não um router.refresh(): com a conexão de
    // volta, o que precisa ser rebuscado é o documento inteiro.
    expect(reload).toHaveBeenCalled();
  });

  it("não lê token nem dispara requisição", () => {
    // Se esta tela chamasse a API, ela falharia exatamente na situação para a
    // qual foi feita. E exigir token mandaria para o /login quem só está sem
    // internet.
    const fetchSpy = jest.fn();
    (global as { fetch: unknown }).fetch = fetchSpy;
    const getItem = jest.spyOn(Storage.prototype, "getItem");

    render(<OfflinePage />);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalledWith("access_token");
    getItem.mockRestore();
  });
});
