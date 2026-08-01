/**
 * Política de cache do service worker (#321).
 *
 * A decisão "esta requisição pode ir para o cache?" vive numa função pura
 * justamente para ser testada aqui: dentro do `sw.js` ela só rodaria num
 * ambiente de service worker, que o jest não tem. Um erro nesta função é caro —
 * cachear uma resposta da API significa servir dado de uma organização (ou de
 * outro usuário logado antes) para quem não deveria vê-lo.
 */
import { chaveDeCacheApi, podeCachear, podeCachearApi, respostaCacheavel } from "@/lib/sw-cache";

const ORIGEM = "https://app.themonitor.com";

function req(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return {
    url,
    method: init.method ?? "GET",
    headers: new Headers(init.headers ?? {}),
  };
}

describe("podeCachear", () => {
  it("cacheia asset estático do próprio domínio", () => {
    expect(podeCachear(req(`${ORIGEM}/_next/static/chunks/main-abc123.js`), ORIGEM)).toBe(true);
    expect(podeCachear(req(`${ORIGEM}/icons/icon-192.png`), ORIGEM)).toBe(true);
  });

  it("NÃO cacheia chamada da API", () => {
    // O cache de leituras da API é a #325, e tem regra própria (chave por
    // token+org). Até lá, nada de /api/ entra no cache do shell.
    expect(podeCachear(req(`${ORIGEM}/api/v1/metrics/`), ORIGEM)).toBe(false);
    expect(podeCachear(req(`${ORIGEM}/api/v1/me/`), ORIGEM)).toBe(false);
  });

  it("NÃO cacheia requisição autenticada, mesmo que a URL pareça inofensiva", () => {
    // Esta é a rede de segurança: se amanhã alguém servir dado por uma rota
    // fora de /api/, o header ainda barra. Resposta autenticada no cache é
    // vazamento entre contas no mesmo navegador.
    const autenticada = req(`${ORIGEM}/relatorio.csv`, { headers: { Authorization: "Bearer abc" } });
    expect(podeCachear(autenticada, ORIGEM)).toBe(false);
  });

  it("NÃO cacheia nada que não seja GET", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(podeCachear(req(`${ORIGEM}/icons/icon-192.png`, { method }), ORIGEM)).toBe(false);
    }
  });

  it("NÃO cacheia outro domínio", () => {
    // Cross-origin volta como resposta opaca: não dá para saber se deu 200 ou
    // 500, e cada uma ocupa a cota inteira do cache. Inclui o backend em dev
    // (localhost:8000) e o script do Google Sign-In.
    expect(podeCachear(req("http://localhost:8000/api/v1/metrics/"), ORIGEM)).toBe(false);
    expect(podeCachear(req("https://accounts.google.com/gsi/client"), ORIGEM)).toBe(false);
  });

  it("NÃO cacheia esquema que não é http(s)", () => {
    // chrome-extension:// estoura o cache.put com TypeError.
    expect(podeCachear(req("chrome-extension://abcdef/inject.js"), ORIGEM)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cache das leituras da API (#325)
// ---------------------------------------------------------------------------
//
// A Cache API indexa por URL e IGNORA os headers. Como o `apiFetch` manda
// `Authorization` e `X-Org-Id` em toda chamada, duas organizações batendo em
// `/api/v1/metrics/` colidiriam na mesma entrada — e quem trocasse de org veria
// o dado da anterior. Vazamento entre organizações é falha de segurança, não
// incômodo de tela. Daí a chave sintética.

const TOKEN_A = "eyJhbGciOiJIUzI1NiJ9.usuarioA.assinaturaA";
const TOKEN_B = "eyJhbGciOiJIUzI1NiJ9.usuarioB.assinaturaB";

function reqApi(caminho: string, init: { method?: string; token?: string; org?: string } = {}) {
  const headers = new Headers();
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.org) headers.set("X-Org-Id", init.org);
  return { url: `${ORIGEM}${caminho}`, method: init.method ?? "GET", headers };
}

describe("podeCachearApi", () => {
  it("cacheia GET da API", () => {
    expect(podeCachearApi(reqApi("/api/v1/metrics/", { token: TOKEN_A, org: "1" }), ORIGEM)).toBe(true);
  });

  it("NUNCA cacheia escrita", () => {
    // Um POST no cache faria a tela mostrar o resultado de um lançamento que
    // talvez nem tenha sido gravado.
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(podeCachearApi(reqApi("/api/v1/logs/", { method, token: TOKEN_A, org: "1" }), ORIGEM)).toBe(false);
    }
  });

  it("não cacheia o que não é da API — isso é do cache do shell", () => {
    expect(podeCachearApi(reqApi("/icons/icon-192.png", { token: TOKEN_A }), ORIGEM)).toBe(false);
  });

  it("não cacheia API de outro domínio", () => {
    const outro = { url: "http://localhost:8000/api/v1/metrics/", method: "GET", headers: new Headers() };
    expect(podeCachearApi(outro, ORIGEM)).toBe(false);
  });
});

describe("chaveDeCacheApi — separação por identidade", () => {
  it("mesma URL e ORGS DIFERENTES geram chaves diferentes", () => {
    // O aceite mais importante da issue: trocar de organização nunca pode
    // mostrar dado da anterior.
    const org1 = chaveDeCacheApi(reqApi("/api/v1/metrics/", { token: TOKEN_A, org: "1" }));
    const org2 = chaveDeCacheApi(reqApi("/api/v1/metrics/", { token: TOKEN_A, org: "2" }));

    expect(org1).not.toBe(org2);
  });

  it("mesma URL e TOKENS DIFERENTES geram chaves diferentes", () => {
    // Logout seguido de login de outra pessoa no mesmo navegador.
    const a = chaveDeCacheApi(reqApi("/api/v1/metrics/", { token: TOKEN_A, org: "1" }));
    const b = chaveDeCacheApi(reqApi("/api/v1/metrics/", { token: TOKEN_B, org: "1" }));

    expect(a).not.toBe(b);
  });

  it("mesma identidade e mesma URL geram a MESMA chave", () => {
    // Sem isto não haveria cache nenhum: toda visita seria um miss.
    const primeira = chaveDeCacheApi(reqApi("/api/v1/metrics/", { token: TOKEN_A, org: "1" }));
    const segunda = chaveDeCacheApi(reqApi("/api/v1/metrics/", { token: TOKEN_A, org: "1" }));

    expect(primeira).toBe(segunda);
  });

  it("a query faz parte da chave", () => {
    // /logs/?metric_id=1 e ?metric_id=2 são leituras diferentes.
    const um = chaveDeCacheApi(reqApi("/api/v1/logs/?metric_id=1", { token: TOKEN_A, org: "1" }));
    const dois = chaveDeCacheApi(reqApi("/api/v1/logs/?metric_id=2", { token: TOKEN_A, org: "1" }));

    expect(um).not.toBe(dois);
  });

  it("não escreve o token na chave", () => {
    // A chave aparece no DevTools e vai para o disco. O token já está no
    // localStorage, mas não há motivo para espalhá-lo mais.
    const chave = chaveDeCacheApi(reqApi("/api/v1/metrics/", { token: TOKEN_A, org: "1" }));

    expect(chave).not.toContain(TOKEN_A);
    expect(chave).not.toContain("usuarioA");
  });

  it("distingue anônimo de autenticado na mesma URL", () => {
    const anonimo = chaveDeCacheApi(reqApi("/api/v1/catalog/", { org: "1" }));
    const logado = chaveDeCacheApi(reqApi("/api/v1/catalog/", { token: TOKEN_A, org: "1" }));

    expect(anonimo).not.toBe(logado);
  });
});

describe("respostaCacheavel", () => {
  it("guarda o 200", () => {
    expect(respostaCacheavel({ ok: true, status: 200 })).toBe(true);
  });

  it("NUNCA guarda erro", () => {
    // Um 401 em cache seria servido de volta depois do login e a tela mostraria
    // "sessão expirada" para quem acabou de entrar.
    for (const status of [401, 403, 404, 500, 502]) {
      expect(respostaCacheavel({ ok: false, status })).toBe(false);
    }
  });

  it("não guarda resposta opaca", () => {
    // status 0 é a resposta opaca de cross-origin: não dá para saber se deu
    // certo, e guardá-la é guardar um erro sem saber.
    expect(respostaCacheavel({ ok: false, status: 0 })).toBe(false);
  });
});
