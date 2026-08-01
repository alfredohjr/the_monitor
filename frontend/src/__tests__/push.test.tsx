/**
 * Assinatura de push no navegador (#328).
 *
 * Três coisas quebram aqui e nenhuma dá erro claro:
 *
 * 1. `applicationServerKey` precisa de `Uint8Array`. A chave VAPID vem em
 *    base64**url** (com `-` e `_`, sem padding), e passá-la como string ou
 *    convertê-la com `atob` direto falha com "InvalidCharacterError".
 * 2. Pedir permissão fora de um gesto do usuário faz o navegador negar — e o
 *    "bloqueado" fica gravado para sempre, sem como desfazer por código.
 * 3. A chave é `NEXT_PUBLIC_*`, ou seja, inlinada em BUILD time. Sem ela no
 *    build, tudo passa nos testes e nada funciona em produção (#202/#203).
 */
import { render } from "@testing-library/react";

import PushToggle from "@/components/notifications/PushToggle";
import { ativarPush, base64UrlParaUint8Array, desativarPush, pushSuportado } from "@/lib/push";

const CHAVE_VAPID = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";

type Janela = typeof globalThis & {
  PushManager?: unknown;
  Notification?: unknown;
};

function fingirNavegadorComSuporte(opcoes: {
  permissao?: string;
  inscricao?: unknown;
  subscribe?: jest.Mock;
  unsubscribe?: jest.Mock;
} = {}) {
  const subscribe =
    opcoes.subscribe ??
    jest.fn().mockResolvedValue({
      toJSON: () => ({
        endpoint: "https://fcm.example/aparelho",
        keys: { p256dh: "chave-p256dh", auth: "chave-auth" },
      }),
      unsubscribe: opcoes.unsubscribe ?? jest.fn().mockResolvedValue(true),
    });

  const pushManager = {
    subscribe,
    getSubscription: jest.fn().mockResolvedValue(opcoes.inscricao ?? null),
  };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  });
  (globalThis as Janela).PushManager = function () {};
  (globalThis as Janela).Notification = {
    permission: opcoes.permissao ?? "default",
    requestPermission: jest.fn().mockResolvedValue(opcoes.permissao ?? "granted"),
  };

  return { subscribe, pushManager };
}

function limparNavegador() {
  // @ts-expect-error — devolvendo o jsdom ao estado original
  delete navigator.serviceWorker;
  delete (globalThis as Janela).PushManager;
  delete (globalThis as Janela).Notification;
}

afterEach(() => {
  limparNavegador();
  localStorage.clear();
  delete (global as { fetch?: unknown }).fetch;
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// A conversão da chave
// ---------------------------------------------------------------------------

describe("base64UrlParaUint8Array", () => {
  it("converte para os bytes certos", () => {
    // "AQIDBA" em base64url = bytes 1,2,3,4.
    expect(Array.from(base64UrlParaUint8Array("AQIDBA"))).toEqual([1, 2, 3, 4]);
  });

  it("traduz o alfabeto base64URL (- e _), que o atob não aceita", () => {
    // 0xFB 0xFF -> base64 "+/8=" -> base64url "-_8". Passar isso direto para o
    // atob levanta InvalidCharacterError.
    expect(Array.from(base64UrlParaUint8Array("-_8"))).toEqual([251, 255]);
  });

  it("repõe o padding que o base64url omite", () => {
    // Comprimento 86 (a chave VAPID real) não é múltiplo de 4.
    expect(CHAVE_VAPID.length % 4).not.toBe(0);
    expect(() => base64UrlParaUint8Array(CHAVE_VAPID)).not.toThrow();
  });

  it("devolve os 65 bytes de uma chave VAPID de verdade", () => {
    // Chave de curva P-256 não comprimida: 1 byte de prefixo + 32 + 32.
    expect(base64UrlParaUint8Array(CHAVE_VAPID)).toHaveLength(65);
  });
});

// ---------------------------------------------------------------------------
// Suporte do navegador
// ---------------------------------------------------------------------------

describe("pushSuportado", () => {
  it("é falso onde não há PushManager", () => {
    // Safari antigo, Firefox no iOS, navegador embutido de app. A tela não pode
    // oferecer um botão que nunca vai funcionar.
    expect(pushSuportado()).toBe(false);
  });

  it("é verdadeiro no navegador completo", () => {
    fingirNavegadorComSuporte();
    expect(pushSuportado()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ativar
// ---------------------------------------------------------------------------

describe("ativarPush", () => {
  function mockFetch() {
    const fn = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    (global as { fetch: unknown }).fetch = fn;
    return fn;
  }

  it("sem suporte devolve indisponivel, sem lançar", () => {
    return expect(ativarPush(CHAVE_VAPID)).resolves.toBe("indisponivel");
  });

  it("sem chave VAPID devolve indisponivel", async () => {
    // O caso do build feito sem o build-arg (#202/#203). Sem esta guarda o
    // subscribe falharia com um erro de conversão, longe da causa real.
    fingirNavegadorComSuporte();
    await expect(ativarPush("")).resolves.toBe("indisponivel");
  });

  it("permissão negada devolve negada e NÃO chama o backend", async () => {
    const { subscribe } = fingirNavegadorComSuporte({ permissao: "denied" });
    const fetchMock = mockFetch();

    await expect(ativarPush(CHAVE_VAPID)).resolves.toBe("negada");

    expect(subscribe).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("assina e registra no backend com o payload que ele espera", async () => {
    fingirNavegadorComSuporte({ permissao: "granted" });
    localStorage.setItem("access_token", "tok");
    const fetchMock = mockFetch();

    await expect(ativarPush(CHAVE_VAPID)).resolves.toBe("ok");

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/push/subscribe/");
    // O navegador entrega as chaves ANINHADAS em `keys`; o backend espera
    // plano. Sem o achatamento, p256dh e auth chegam indefinidos e o envio
    // falha depois, na criptografia.
    expect(JSON.parse(opts.body)).toEqual({
      endpoint: "https://fcm.example/aparelho",
      p256dh: "chave-p256dh",
      auth: "chave-auth",
      platform: "web",
    });
  });

  it("manda a chave como Uint8Array, não como string", async () => {
    const { subscribe } = fingirNavegadorComSuporte({ permissao: "granted" });
    mockFetch();

    await ativarPush(CHAVE_VAPID);

    const args = subscribe.mock.calls[0][0];
    expect(args.applicationServerKey).toBeInstanceOf(Uint8Array);
    // Sem `userVisibleOnly` o Chrome recusa a inscrição.
    expect(args.userVisibleOnly).toBe(true);
  });

  it("falha do backend não deixa exceção vazar para a tela", async () => {
    fingirNavegadorComSuporte({ permissao: "granted" });
    (global as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error("500"));

    await expect(ativarPush(CHAVE_VAPID)).resolves.toBe("erro");
  });
});

// ---------------------------------------------------------------------------
// Desativar
// ---------------------------------------------------------------------------

describe("desativarPush", () => {
  it("avisa o backend e cancela no navegador", async () => {
    const unsubscribe = jest.fn().mockResolvedValue(true);
    fingirNavegadorComSuporte({
      inscricao: { endpoint: "https://fcm.example/aparelho", unsubscribe },
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    (global as { fetch: unknown }).fetch = fetchMock;

    await desativarPush();

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/push/subscribe/");
    expect(opts.method).toBe("DELETE");
    expect(JSON.parse(opts.body)).toEqual({ endpoint: "https://fcm.example/aparelho" });
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("sem inscrição ativa não quebra", async () => {
    fingirNavegadorComSuporte();
    await expect(desativarPush()).resolves.toBeUndefined();
  });

  it("sem suporte no navegador não quebra", async () => {
    await expect(desativarPush()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// O botão na tela (#328)
// ---------------------------------------------------------------------------

describe("PushToggle", () => {
  // O componente lê o suporte do navegador na MONTAGEM, não no import — por
  // isso cada teste prepara o ambiente antes de renderizar.
  const montar = () => render(<PushToggle />);

  it("avisa quando o navegador não suporta, em vez de oferecer um botão morto", async () => {
    const { findByText } = montar();
    expect(await findByText("This browser does not support push notifications.")).toBeInTheDocument();
  });

  it("oferece ativar quando ainda não foi decidido", async () => {
    fingirNavegadorComSuporte({ permissao: "default" });
    const { findByRole } = montar();
    expect(await findByRole("button", { name: "Turn on push notifications" })).toBeInTheDocument();
  });

  it("NÃO pede permissão na montagem", async () => {
    // O erro que custaria caro: fora de um gesto do usuário o navegador tende
    // a negar, e "bloqueado" fica gravado para sempre.
    fingirNavegadorComSuporte({ permissao: "default" });
    const pedir = (globalThis as Janela).Notification as { requestPermission: jest.Mock };

    montar();
    await new Promise((r) => setTimeout(r, 0));

    expect(pedir.requestPermission).not.toHaveBeenCalled();
  });

  it("explica como desbloquear quando a permissão foi negada antes", async () => {
    // "Bloqueado" não se desfaz por código: o texto precisa mandar a pessoa
    // para as configurações do navegador.
    fingirNavegadorComSuporte({ permissao: "denied" });
    const { findByText } = montar();
    expect(await findByText(/blocked for this site/i)).toBeInTheDocument();
  });

  it("renderiza em pt-BR", async () => {
    localStorage.setItem("locale", "pt-BR");
    fingirNavegadorComSuporte({ permissao: "default" });
    const { findByRole } = montar();
    expect(await findByRole("button", { name: "Ativar notificações push" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// A chave chega ao bundle? (#202/#203)
// ---------------------------------------------------------------------------

describe("encadeamento do build-arg", () => {
  // `NEXT_PUBLIC_*` é inlinado em BUILD time. Se o Dockerfile ou o CI não
  // passarem a chave, tudo aqui continua verde e o push simplesmente não
  // funciona em produção — foi exatamente o que aconteceu com o Client ID do
  // Google nos #202/#203. Estes testes são baratos e fecham esse buraco.
  const fs = require("fs");
  const path = require("path");
  const raiz = path.resolve(__dirname, "../..");

  it("o Dockerfile declara ARG e ENV da chave pública", () => {
    const dockerfile = fs.readFileSync(path.join(raiz, "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
    expect(dockerfile).toMatch(/ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=\$\{NEXT_PUBLIC_VAPID_PUBLIC_KEY\}/);
  });

  it("o workflow de release passa a chave como build-arg", () => {
    const release = fs.readFileSync(path.join(raiz, "../.github/workflows/release.yml"), "utf8");
    expect(release).toMatch(/NEXT_PUBLIC_VAPID_PUBLIC_KEY=\$\{\{ vars\.NEXT_PUBLIC_VAPID_PUBLIC_KEY \}\}/);
  });

  it("a chave PRIVADA nunca aparece na configuração do frontend", () => {
    // Ela cifra o payload e vive só no backend. Um NEXT_PUBLIC_ com ela iria
    // parar no bundle, que é público.
    const dockerfile = fs.readFileSync(path.join(raiz, "Dockerfile"), "utf8");
    const release = fs.readFileSync(path.join(raiz, "../.github/workflows/release.yml"), "utf8");
    expect(dockerfile).not.toMatch(/VAPID_PRIVATE_KEY/);
    expect(release).not.toMatch(/VAPID_PRIVATE_KEY/);
  });
});
