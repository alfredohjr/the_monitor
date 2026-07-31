// Política de cache do service worker (#321).
//
// Mora fora do `public/sw.js` de propósito: dentro do service worker esta
// decisão só seria exercitável num navegador de verdade, e é a parte em que
// errar custa caro. O `sw.js` reimplementa a mesma regra em JS puro (não dá
// para importar TS de dentro dele sem bundler); o teste aqui é o que fixa a
// regra, e há um teste no `sw.js` conferindo que as duas listas não divergiram.

/** O mínimo de uma Request que a decisão precisa — um `Request` real satisfaz. */
export type RequisicaoAvaliavel = {
  url: string;
  method: string;
  headers: { get(nome: string): string | null };
};

/** Prefixos de caminho que nunca entram no cache do shell. */
export const PREFIXOS_PROIBIDOS = ["/api/"];

/**
 * Esta requisição pode ser guardada no cache do shell?
 *
 * Conservadora por desenho: só passa GET, do mesmo domínio, sem credencial e
 * fora da API. Qualquer dúvida responde `false` — o custo de não cachear é uma
 * requisição de rede; o de cachear errado é servir dado de outra conta.
 *
 * @param origem `self.location.origin` no service worker.
 */
export function podeCachear(req: RequisicaoAvaliavel, origem: string): boolean {
  if (req.method !== "GET") return false;

  // Resposta autenticada nunca entra. Vem antes da checagem de caminho porque é
  // a rede de segurança: vale mesmo para uma rota nova fora de /api/.
  if (req.headers.get("Authorization")) return false;

  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return false;
  }

  // chrome-extension:, data:, blob: — `cache.put` rejeita com TypeError.
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  // Cross-origin volta opaco: não dá para distinguir 200 de 500, e cada
  // resposta dessas consome a cota de armazenamento inteira.
  if (url.origin !== origem) return false;

  return !PREFIXOS_PROIBIDOS.some((prefixo) => url.pathname.startsWith(prefixo));
}
