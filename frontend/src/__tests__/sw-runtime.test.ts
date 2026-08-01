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

  // Conteúdo por chave, para o cache do harness se comportar como cache de
  // verdade: o que foi guardado sob uma chave só volta por aquela chave. É o
  // que torna observável o vazamento entre organizações (#325).
  const guardado: Record<string, unknown> = {};

  const cacheFalso = (nome: string) => {
    cachesAbertos[nome] = cachesAbertos[nome] || { adicionados: [], put: [] };
    return {
      add: (url: string) => {
        cachesAbertos[nome].adicionados.push(url);
        return Promise.resolve();
      },
      put: (chave: unknown, valor: unknown) => {
        cachesAbertos[nome].put.push(chave);
        guardado[String(chave)] = valor;
        return Promise.resolve();
      },
      match: (chave: unknown) => Promise.resolve(guardado[String(chave)]),
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
    guardado,
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

  it("precacheia a rota /offline — sem ela o fallback não tem o que servir", async () => {
    // O handler de navegação responde `caches.match("/offline")`; se a rota não
    // estiver no cache, isso resolve `undefined` e o usuário vê o erro de rede
    // do navegador. Tirar `/offline` do PRECACHE não quebrava nenhum teste até
    // este existir.
    const { handlers, cachesAbertos } = carregarSW("1.2.3");
    const esperas: Promise<unknown>[] = [];
    handlers.install({ waitUntil: (p: Promise<unknown>) => esperas.push(p) } as never);
    await Promise.all(esperas);

    expect(cachesAbertos["themonitor-shell-1.2.3"].adicionados).toContain("/offline");
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

  it("a chamada da API não entra no cache do SHELL", () => {
    // Contrato do #321, que a #325 NÃO afrouxou: o shell nunca guarda resposta
    // de API. O que mudou é que agora existe um cache separado para ela, com
    // chave por usuário+org — o teste de vazamento fica no bloco do #325.
    const { ctx } = carregarSW();
    const podeCachear = ctx.podeCachear as (r: unknown, o: string) => boolean;
    expect(podeCachear(req(`${ORIGEM}/api/v1/metrics/`), ORIGEM)).toBe(false);
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

  it("rede caída em navegação cai na tela offline (#322)", async () => {
    // Sem isto o app instalado mostra o dinossauro do Chrome, que dentro de um
    // app parece defeito nosso.
    const { handlers, ctx } = carregarSW();
    ctx.fetch = () => Promise.reject(new Error("offline"));
    const procurados: unknown[] = [];
    (ctx.caches as { match: unknown }).match = (chave: unknown) => {
      procurados.push(chave);
      // Nada da rota pedida no cache — força chegar ao último recurso.
      return Promise.resolve(procurados.length > 1 ? { offline: true } : undefined);
    };

    const e = eventoDe(req(`${ORIGEM}/dashboard`), "navigate");
    handlers.fetch(e.evento as never);
    await new Promise((r) => setTimeout(r, 0));

    expect(procurados[procurados.length - 1]).toBe("/offline");
  });

  it("offline com a página já visitada serve a própria página, não a tela offline", async () => {
    // Preferir o conteúdo real ao aviso genérico: quem já abriu o painel antes
    // continua vendo o painel, mesmo sem rede.
    const { handlers, ctx } = carregarSW();
    ctx.fetch = () => Promise.reject(new Error("offline"));
    const procurados: unknown[] = [];
    (ctx.caches as { match: unknown }).match = (chave: unknown) => {
      procurados.push(chave);
      return Promise.resolve({ doCache: true });
    };

    const e = eventoDe(req(`${ORIGEM}/dashboard`), "navigate");
    handlers.fetch(e.evento as never);
    await new Promise((r) => setTimeout(r, 0));

    expect(procurados).toHaveLength(1);
    expect(procurados[0]).not.toBe("/offline");
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

// ---------------------------------------------------------------------------
// Cache das leituras da API (#325)
// ---------------------------------------------------------------------------

describe("sw.js — stale-while-revalidate da API", () => {
  const TOKEN_A = "Bearer eyJhbGciOiJIUzI1NiJ9.usuarioA.aaa";
  const TOKEN_B = "Bearer eyJhbGciOiJIUzI1NiJ9.usuarioB.bbb";

  function reqApi(caminho: string, headers: Record<string, string>, method = "GET") {
    return { url: `${ORIGEM}${caminho}`, method, headers: new Headers(headers), mode: "cors" };
  }

  function respostaOk(corpo: string) {
    return { ok: true, status: 200, corpo, clone: () => ({ ok: true, status: 200, corpo }) };
  }

  function despachar(sw: ReturnType<typeof carregarSW>, requisicao: unknown) {
    let respondido: Promise<unknown> | null = null;
    sw.handlers.fetch({
      request: requisicao,
      respondWith: (r: Promise<unknown>) => {
        respondido = r;
      },
      waitUntil: () => {},
    } as never);
    return respondido as Promise<unknown> | null;
  }

  it("NÃO devolve dado de outra organização na mesma URL", async () => {
    // O aceite central da issue. A Cache API indexa por URL e ignora headers:
    // sem chave sintética, as duas orgs compartilhariam esta entrada e a
    // segunda leitura devolveria "dados da org 1".
    const sw = carregarSW();

    sw.ctx.fetch = () => Promise.resolve(respostaOk("dados da org 1"));
    await despachar(sw, reqApi("/api/v1/metrics/", { Authorization: TOKEN_A, "X-Org-Id": "1" }));

    // Agora a org 2, mesmo usuário, MESMA URL — e a rede fora do ar, para que
    // qualquer resposta só possa vir do cache.
    sw.ctx.fetch = () => Promise.reject(new Error("offline"));
    const resposta = await despachar(
      sw,
      reqApi("/api/v1/metrics/", { Authorization: TOKEN_A, "X-Org-Id": "2" })
    ).catch(() => "erro de rede");

    expect(resposta).toBe("erro de rede");
  });

  it("NÃO devolve dado de outro usuário na mesma URL e org", async () => {
    // Logout seguido de login de outra pessoa no mesmo navegador.
    const sw = carregarSW();

    sw.ctx.fetch = () => Promise.resolve(respostaOk("dados do usuário A"));
    await despachar(sw, reqApi("/api/v1/me/", { Authorization: TOKEN_A, "X-Org-Id": "1" }));

    sw.ctx.fetch = () => Promise.reject(new Error("offline"));
    const resposta = await despachar(
      sw,
      reqApi("/api/v1/me/", { Authorization: TOKEN_B, "X-Org-Id": "1" })
    ).catch(() => "erro de rede");

    expect(resposta).toBe("erro de rede");
  });

  it("serve o cache na hora e revalida em segundo plano", async () => {
    const sw = carregarSW();
    const req = reqApi("/api/v1/metrics/", { Authorization: TOKEN_A, "X-Org-Id": "1" });

    sw.ctx.fetch = () => Promise.resolve(respostaOk("versão 1"));
    await despachar(sw, req);

    // Segunda visita: a rede tem dado novo, mas a resposta imediata é a do
    // cache — é isso que faz o app abrir com conteúdo em vez de spinner.
    let bateuNaRede = false;
    sw.ctx.fetch = () => {
      bateuNaRede = true;
      return Promise.resolve(respostaOk("versão 2"));
    };
    const resposta = (await despachar(sw, req)) as { corpo: string };

    expect(resposta.corpo).toBe("versão 1");
    expect(bateuNaRede).toBe(true);
  });

  it("NUNCA guarda resposta de erro", async () => {
    // Um 401 guardado seria servido depois do login e diria "sessão expirada"
    // para quem acabou de entrar.
    const sw = carregarSW();
    const req = reqApi("/api/v1/metrics/", { Authorization: TOKEN_A, "X-Org-Id": "1" });

    sw.ctx.fetch = () => Promise.resolve({ ok: false, status: 401, clone: () => ({}) });
    await despachar(sw, req);

    expect(Object.keys(sw.guardado)).toHaveLength(0);
  });

  it("NÃO intercepta escrita", async () => {
    const sw = carregarSW();
    let respondido = false;
    sw.handlers.fetch({
      request: reqApi("/api/v1/logs/", { Authorization: TOKEN_A, "X-Org-Id": "1" }, "POST"),
      respondWith: () => {
        respondido = true;
      },
      waitUntil: () => {},
    } as never);

    expect(respondido).toBe(false);
  });

  it("o cache da API sobrevive ao activate — ele guarda dado, não build", async () => {
    // O cache do shell é versionado e limpo a cada deploy. Fazer o mesmo com o
    // da API jogaria fora justamente o que faz o app abrir com dado na tela.
    const sw = carregarSW("2.0.0");
    sw.setChaves(["themonitor-shell-1.0.0", "themonitor-api"]);

    const esperas: Promise<unknown>[] = [];
    sw.handlers.activate({ waitUntil: (p: Promise<unknown>) => esperas.push(p) } as never);
    await Promise.all(esperas);

    expect(sw.apagados).toEqual(["themonitor-shell-1.0.0"]);
  });
});

// ---------------------------------------------------------------------------
// Web Push (#328)
// ---------------------------------------------------------------------------

describe("sw.js — push recebido", () => {
  function carregarComClients(janelas: { url: string; focus?: jest.Mock }[] = []) {
    const sw = carregarSW();
    const mostradas: { titulo: string; opcoes: Record<string, unknown> }[] = [];
    const abertas: string[] = [];
    const self = sw.ctx.self as Record<string, unknown>;
    self.registration = {
      showNotification: (titulo: string, opcoes: Record<string, unknown>) => {
        mostradas.push({ titulo, opcoes });
        return Promise.resolve();
      },
    };
    self.clients = {
      matchAll: () => Promise.resolve(janelas),
      openWindow: (url: string) => {
        abertas.push(url);
        return Promise.resolve();
      },
    };
    return { sw, mostradas, abertas };
  }

  it("mostra a notificação com título, corpo e ícone", async () => {
    const { sw, mostradas } = carregarComClients();
    const esperas: Promise<unknown>[] = [];

    sw.handlers.push({
      data: { json: () => ({ title: "Meta atingida", body: "Você chegou lá", url: "/notifications" }) },
      waitUntil: (p: Promise<unknown>) => esperas.push(p),
    } as never);
    await Promise.all(esperas);

    expect(mostradas[0].titulo).toBe("Meta atingida");
    expect(mostradas[0].opcoes.body).toBe("Você chegou lá");
    expect(mostradas[0].opcoes.icon).toBe("/icons/icon-192.png");
  });

  it("payload quebrado ainda mostra algo", async () => {
    // Sem showNotification o Chrome exibe "Este site foi atualizado em segundo
    // plano" — pior que um título genérico.
    const { sw, mostradas } = carregarComClients();
    const esperas: Promise<unknown>[] = [];

    sw.handlers.push({
      data: {
        json: () => {
          throw new Error("not json");
        },
      },
      waitUntil: (p: Promise<unknown>) => esperas.push(p),
    } as never);
    await Promise.all(esperas);

    expect(mostradas).toHaveLength(1);
    expect(mostradas[0].titulo).toBe("themonitor");
  });

  it("clicar foca a janela já aberta em vez de abrir outra", async () => {
    // Sem isto, cada notificação clicada deixa mais uma aba do app para trás.
    const focus = jest.fn();
    const { sw, abertas } = carregarComClients([{ url: "https://app.themonitor.com/notifications", focus }]);
    const esperas: Promise<unknown>[] = [];
    const fechar = jest.fn();

    sw.handlers.notificationclick({
      notification: { close: fechar, data: { url: "/notifications" } },
      waitUntil: (p: Promise<unknown>) => esperas.push(p),
    } as never);
    await Promise.all(esperas);

    expect(focus).toHaveBeenCalled();
    expect(abertas).toEqual([]);
    expect(fechar).toHaveBeenCalled();
  });

  it("sem janela aberta, abre a rota da notificação", async () => {
    const { sw, abertas } = carregarComClients([]);
    const esperas: Promise<unknown>[] = [];

    sw.handlers.notificationclick({
      notification: { close: jest.fn(), data: { url: "/goals" } },
      waitUntil: (p: Promise<unknown>) => esperas.push(p),
    } as never);
    await Promise.all(esperas);

    expect(abertas).toEqual(["/goals"]);
  });
});
