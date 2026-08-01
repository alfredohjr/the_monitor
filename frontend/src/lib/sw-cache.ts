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

/** Prefixo das leituras da API que ganham cache próprio (#325). */
export const PREFIXO_API = "/api/v1/";

// Nome do cache das leituras da API. SEM a versão do app de propósito: ele
// guarda dado do usuário, não build — apagá-lo a cada deploy jogaria fora
// justamente o que faz o app abrir com conteúdo na tela. Espelhado no sw.js.
export const PREFIXO_CACHE_API = "themonitor-api";

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

// ---------------------------------------------------------------------------
// Cache das leituras da API (#325)
// ---------------------------------------------------------------------------
//
// A Cache API indexa por URL e IGNORA os headers. O `apiFetch` manda
// `Authorization` e `X-Org-Id` em toda chamada, então `/api/v1/metrics/` de duas
// organizações cairia na MESMA entrada — e quem trocasse de org veria o dado da
// anterior. Por isso a chave é sintética: ela carrega a identidade que a URL
// sozinha não carrega.

/** Uma leitura da API que pode ser guardada? Só GET, só da nossa origem. */
export function podeCachearApi(req: RequisicaoAvaliavel, origem: string): boolean {
  if (req.method !== "GET") return false;

  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return false;
  }

  if (url.origin !== origem) return false;
  return url.pathname.startsWith(PREFIXO_API);
}

/**
 * Digest curto e determinístico (FNV-1a, duas passadas).
 *
 * Serve para NÃO escrever o token na chave: ela aparece no DevTools e vai para
 * o disco. O token já mora no localStorage, mas não há motivo para espalhá-lo.
 * Duas passadas (direta e invertida) dão 64 bits, o suficiente para que dois
 * tokens distintos não colidam na prática.
 */
function digest(texto: string): string {
  const passada = (entrada: string): string => {
    let h = 0x811c9dc5;
    for (let i = 0; i < entrada.length; i++) {
      h ^= entrada.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return passada(texto) + passada(texto.split("").reverse().join(""));
}

/**
 * Chave sob a qual esta leitura é guardada.
 *
 * Formato: `<origem>/__api-cache/<identidade><caminho><query>`. É uma URL
 * sintética — nunca é buscada na rede, só usada como índice no `cache.put` e no
 * `cache.match`.
 *
 * A identidade junta usuário e organização. Sem ela, trocar de org mostraria
 * dado da anterior, e um logout seguido de login de outra pessoa no mesmo
 * navegador mostraria dado de quem saiu.
 */
export function chaveDeCacheApi(req: RequisicaoAvaliavel): string {
  const url = new URL(req.url);
  const auth = req.headers.get("Authorization");
  const org = req.headers.get("X-Org-Id") || "sem-org";
  const usuario = auth ? `u${digest(auth)}` : "anon";
  return `${url.origin}/__api-cache/${usuario}-o${org}${url.pathname}${url.search}`;
}

/**
 * Esta resposta pode ser guardada?
 *
 * Só o sucesso. Um 401 em cache seria servido de volta depois do login e a tela
 * diria "sessão expirada" para quem acabou de entrar; um 500 guardado
 * transformaria uma falha momentânea do servidor em erro permanente naquele
 * navegador. `status === 0` é a resposta opaca: guardá-la é guardar um erro sem
 * saber que é um.
 */
export function respostaCacheavel(resposta: { ok: boolean; status: number }): boolean {
  return resposta.ok && resposta.status > 0;
}
