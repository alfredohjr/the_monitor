/**
 * O `public/sw.js` de verdade, executado (#321).
 *
 * `sw-cache.test.ts` cobre a função pura em TypeScript; este arquivo cobre o
 * que realmente é servido ao navegador. Os dois existem porque um service
 * worker clássico não importa TS: a regra está escrita duas vezes, e sem este
 * teste as cópias divergiriam calada — a de produção sendo justamente a que
 * ninguém testa.
 *
 * O truque é `vm.runInNewContext`: num script clássico o `self` É o global, e
 * declarações de topo viram propriedades dele. Rodando o arquivo com um global
 * fabricado, dá para pegar as funções e os handlers registrados.
 */
import fs from "fs";
import path from "path";
import vm from "vm";

const SW = fs.readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
const ORIGEM = "https://app.themonitor.com";

// `const` no topo de um script cria binding léxico, não propriedade do global —
// só `function` vira propriedade. Em vez de rebaixar o sw.js para `var` só para
// o teste enxergar, o harness anexa uma linha que publica o valor.
const SW_INSTRUMENTADO = SW + "\n;self.__CACHE = CACHE;";

type Handlers = Record<string, (evento: unknown) => void>;

function carregarSW(versao = "9.9.9") {
  const handlers: Handlers = {};
  const cachesAbertos: Record<string, { adicionados: string[]; put: unknown[] }> = {};
  let chaves: string[] = [];
  const apagados: string[] = [];

  const cacheFalso = (nome: string) => {
    cachesAbertos[nome] = cachesAbertos[nome] || { adicionados: [], put: [] };
    return {
      add: (url: string) => {
        cachesAbertos[nome].adicionados.push(url);
        return Promise.resolve();
      },
      put: (req: unknown) => {
        cachesAbertos[nome].put.push(req);
        return Promise.resolve();
      },
      match: () => Promise.resolve(undefined),
    };
  };

  const contexto: Record<string, unknown> = {
    URL,
    Headers,
    Promise,
    console,
    fetch: () => Promise.resolve({ ok: true, type: "basic", clone: () => ({}) }),
    caches: {
      open: (nome: string) => Promise.resolve(cacheFalso(nome)),
      keys: () => Promise.resolve(chaves),
      delete: (nome: string) => {
        apagados.push(nome);
        return Promise.resolve(true);
      },
      match: () => Promise.resolve(undefined),
    },
  };
  contexto.self = {
    location: { href: `${ORIGEM}/sw.js?v=${versao}`, origin: ORIGEM },
    addEventListener: (nome: string, fn: (evento: unknown) => void) => {
      handlers[nome] = fn;
    },
    clients: { claim: () => Promise.resolve() },
  };

  vm.runInNewContext(SW_INSTRUMENTADO, contexto);
  return {
    ctx: contexto,
    nomeDoCache: () => (contexto.self as { __CACHE: string }).__CACHE,
    handlers,
    cachesAbertos,
    apagados,
    setChaves: (k: string[]) => {
      chaves = k;
    },
  };
}

function req(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return { url, method: init.method ?? "GET", headers: new Headers(init.headers ?? {}) };
}

describe("sw.js — a regra de cache espelhada", () => {
  const { ctx } = carregarSW();
  const podeCachear = ctx.podeCachear as (r: unknown, o: string) => boolean;

  // A MESMA tabela do sw-cache.test.ts. Se alguém mudar um lado só, cai aqui.
  it.each([
    ["asset estático", req(`${ORIGEM}/_next/static/chunks/main-abc.js`), true],
    ["ícone", req(`${ORIGEM}/icons/icon-192.png`), true],
    ["chamada de API", req(`${ORIGEM}/api/v1/metrics/`), false],
    ["request autenticada", req(`${ORIGEM}/relatorio.csv`, { headers: { Authorization: "Bearer x" } }), false],
    ["POST", req(`${ORIGEM}/icons/icon-192.png`, { method: "POST" }), false],
    ["outro domínio", req("http://localhost:8000/api/v1/metrics/"), false],
    ["extensão do navegador", req("chrome-extension://abc/inject.js"), false],
  ])("%s → %s", (_nome, requisicao, esperado) => {
    expect(podeCachear(requisicao, ORIGEM)).toBe(esperado);
  });
});

describe("sw.js — versionamento do cache", () => {
  it("nomeia o cache com a versão que veio na query do registro", () => {
    expect(carregarSW("1.2.3").nomeDoCache()).toBe("themonitor-shell-1.2.3");
  });

  it("cai num nome de dev quando registram sem versão", () => {
    const handlers: Handlers = {};
    const contexto: Record<string, unknown> = {
      URL,
      Headers,
      Promise,
      caches: { open: () => Promise.resolve({ add: () => Promise.resolve() }) },
    };
    contexto.self = {
      location: { href: `${ORIGEM}/sw.js`, origin: ORIGEM },
      addEventListener: (n: string, f: (e: unknown) => void) => {
        handlers[n] = f;
      },
      clients: { claim: () => Promise.resolve() },
    };
    vm.runInNewContext(SW_INSTRUMENTADO, contexto);
    expect((contexto.self as { __CACHE: string }).__CACHE).toBe("themonitor-shell-dev");
  });
});

describe("sw.js — install", () => {
  it("põe o shell no cache da versão corrente", async () => {
    const { handlers, cachesAbertos } = carregarSW("1.2.3");
    const esperas: Promise<unknown>[] = [];
    handlers.install({ waitUntil: (p: Promise<unknown>) => esperas.push(p) } as never);
    await Promise.all(esperas);

    expect(cachesAbertos["themonitor-shell-1.2.3"].adicionados).toEqual(
      expect.arrayContaining(["/", "/favicon.svg", "/icons/icon-192.png"])
    );
  });

  it("um item que falha não derruba a instalação inteira", async () => {
    // Sem isto, um ícone renomeado deixaria o app sem service worker nenhum,
    // e o sintoma (nada acontece) não aponta para a causa.
    const { handlers, ctx } = carregarSW();
    (ctx.caches as { open: unknown }).open = () =>
      Promise.resolve({
        add: (url: string) => (url === "/favicon.svg" ? Promise.reject(new Error("404")) : Promise.resolve()),
      });

    const esperas: Promise<unknown>[] = [];
    handlers.install({ waitUntil: (p: Promise<unknown>) => esperas.push(p) } as never);

    await expect(Promise.all(esperas)).resolves.toBeDefined();
  });
});

describe("sw.js — activate", () => {
  it("apaga os caches das versões anteriores e mantém o atual", async () => {
    const alvo = carregarSW("2.0.0");
    alvo.setChaves(["themonitor-shell-1.0.0", "themonitor-shell-2.0.0", "outro-app-cache"]);

    const esperas: Promise<unknown>[] = [];
    alvo.handlers.activate({ waitUntil: (p: Promise<unknown>) => esperas.push(p) } as never);
    await Promise.all(esperas);

    // O da versão atual fica; o de outro app na mesma origem não é nossa conta.
    expect(alvo.apagados).toEqual(["themonitor-shell-1.0.0"]);
  });
});

describe("sw.js — fetch", () => {
  function eventoDe(requisicao: unknown, mode = "no-cors") {
    let respondido: unknown = null;
    return {
      evento: {
        request: { ...(requisicao as object), mode },
        respondWith: (r: unknown) => {
          respondido = r;
        },
      },
      teveResposta: () => respondido !== null,
    };
  }

  it("não intercepta chamada da API — segue para a rede", () => {
    const { handlers } = carregarSW();
    const e = eventoDe(req(`${ORIGEM}/api/v1/metrics/`));
    handlers.fetch(e.evento as never);
    expect(e.teveResposta()).toBe(false);
  });

  it("não intercepta requisição autenticada", () => {
    const { handlers } = carregarSW();
    const e = eventoDe(req(`${ORIGEM}/qualquer`, { headers: { Authorization: "Bearer x" } }));
    handlers.fetch(e.evento as never);
    expect(e.teveResposta()).toBe(false);
  });

  it("intercepta asset estático", () => {
    const { handlers } = carregarSW();
    const e = eventoDe(req(`${ORIGEM}/_next/static/chunks/main-abc.js`));
    handlers.fetch(e.evento as never);
    expect(e.teveResposta()).toBe(true);
  });

  it("navegação vai à rede MESMO tendo a página no cache", async () => {
    // Cache primeiro aqui serviria a tela anterior mesmo com internet boa — o
    // sintoma clássico de "fiz deploy e o usuário continua vendo o velho".
    //
    // O hit no cache é o que dá sentido ao teste: sem ele, cache-first também
    // acabaria chamando a rede (cache vazio → fallback) e este teste passaria
    // nos dois desenhos. Confirmei mutando o sw.js para cache-first — só falha
    // com o hit presente.
    const { handlers, ctx } = carregarSW();
    let bateuNaRede = false;
    ctx.fetch = () => {
      bateuNaRede = true;
      return Promise.resolve({ ok: true, type: "basic", clone: () => ({}) });
    };
    (ctx.caches as { match: unknown }).match = () => Promise.resolve({ cacheado: true });

    const e = eventoDe(req(`${ORIGEM}/dashboard`), "navigate");
    handlers.fetch(e.evento as never);
    await Promise.resolve();

    expect(bateuNaRede).toBe(true);
    expect(e.teveResposta()).toBe(true);
  });
});
