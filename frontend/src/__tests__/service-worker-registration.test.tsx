/**
 * Registro do service worker (#321).
 *
 * O componente monta no layout raiz, ou seja, em TODA página. Uma exceção não
 * tratada aqui derruba a árvore inteira — por isso os testes cobrem os
 * ambientes em que `serviceWorker` não existe e o registro falha.
 */
import { render } from "@testing-library/react";

import ServiceWorkerRegistration from "@/components/layout/ServiceWorkerRegistration";
import { APP_VERSION } from "@/lib/version";

const NODE_ENV_ORIGINAL = process.env.NODE_ENV;

function definirNodeEnv(valor: string) {
  // NODE_ENV é readonly no tipo, mas em jest é uma env de verdade (o Next só a
  // inlina no build). Escrever nela é o que permite testar o caminho de produção.
  Object.defineProperty(process.env, "NODE_ENV", { value: valor, configurable: true });
}

afterEach(() => {
  definirNodeEnv(NODE_ENV_ORIGINAL as string);
  // @ts-expect-error — limpando o que os testes injetaram no navigator
  delete navigator.serviceWorker;
});

describe("ServiceWorkerRegistration", () => {
  it("não quebra quando o navegador não tem serviceWorker", () => {
    definirNodeEnv("production");
    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });

  it("registra o sw com a versão do app na query", () => {
    const register = jest.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    definirNodeEnv("production");

    render(<ServiceWorkerRegistration />);

    // A versão na URL é o que faz o navegador buscar o sw.js de novo depois de
    // um deploy: mesma URL, arquivo idêntico byte a byte, nenhuma atualização.
    expect(register).toHaveBeenCalledWith(`/sw.js?v=${APP_VERSION}`);
  });

  it("não registra fora de produção", () => {
    const register = jest.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    definirNodeEnv("development");

    render(<ServiceWorkerRegistration />);

    // Em dev o SW serviria chunk cacheado por cima do HMR do Turbopack, e a
    // tela pararia de refletir o código sem motivo aparente.
    expect(register).not.toHaveBeenCalled();
  });

  it("registro rejeitado não vira erro não tratado", async () => {
    // O aviso é intencional no componente (esconder SecurityError custou caro
    // no #308); aqui ele é só ruído no relatório do CI.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const register = jest.fn().mockRejectedValue(new Error("SecurityError"));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    definirNodeEnv("production");

    render(<ServiceWorkerRegistration />);
    await Promise.resolve();

    expect(register).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("não renderiza nada", () => {
    definirNodeEnv("production");
    const { container } = render(<ServiceWorkerRegistration />);
    expect(container).toBeEmptyDOMElement();
  });
});
