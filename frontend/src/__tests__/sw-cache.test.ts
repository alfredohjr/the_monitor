/**
 * Política de cache do service worker (#321).
 *
 * A decisão "esta requisição pode ir para o cache?" vive numa função pura
 * justamente para ser testada aqui: dentro do `sw.js` ela só rodaria num
 * ambiente de service worker, que o jest não tem. Um erro nesta função é caro —
 * cachear uma resposta da API significa servir dado de uma organização (ou de
 * outro usuário logado antes) para quem não deveria vê-lo.
 */
import { podeCachear } from "@/lib/sw-cache";

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
