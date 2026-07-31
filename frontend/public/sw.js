/* Service worker do app shell (#321).
 *
 * Escopo: só o shell (HTML/CSS/JS). Resposta de API NÃO entra aqui — isso é a
 * #325, que precisa de chave por token+org para não misturar organizações.
 *
 * Escrito à mão em vez de `next-pwa`: o pacote está defasado para o Next 15 com
 * Turbopack, que é como este projeto buda.
 *
 * A regra de cache é espelhada de `src/lib/sw-cache.ts`. Um service worker
 * clássico não importa TS, então a duplicação é inevitável — mas o teste
 * `sw-runtime.test.ts` carrega ESTE arquivo e roda a mesma tabela de casos
 * contra ele, então as duas não divergem em silêncio.
 */

// A versão vem da query do registro (`/sw.js?v=0.6.0`). Sem ela, o navegador
// compararia sempre o mesmo arquivo e nunca atualizaria o SW depois do deploy.
const VERSAO = new URL(self.location.href).searchParams.get("v") || "dev";
const PREFIXO_CACHE = "themonitor-shell-";
const CACHE = PREFIXO_CACHE + VERSAO;

// Mínimo para a app abrir offline. Chunks do /_next/static entram sozinhos no
// primeiro acesso — os nomes têm hash e não dá para listá-los aqui.
// `/offline` é o mais importante da lista: é a única tela que precisa estar
// garantida no cache, porque só aparece quando não há rede para buscá-la (#322).
const PRECACHE = ["/", "/offline", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

const PREFIXOS_PROIBIDOS = ["/api/"];

function podeCachear(req, origem) {
  if (req.method !== "GET") return false;
  if (req.headers.get("Authorization")) return false;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.origin !== origem) return false;

  return !PREFIXOS_PROIBIDOS.some(function (prefixo) {
    return url.pathname.indexOf(prefixo) === 0;
  });
}

self.addEventListener("install", function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Um `addAll` falha inteiro se um único item der 404, e o SW nem chega a
      // instalar. Item a item, um ícone renomeado custa aquele item, não o
      // offline todo.
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () {});
        })
      );
    })
  );
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(
    caches
      .keys()
      .then(function (nomes) {
        return Promise.all(
          nomes
            // Só os nossos: apagar cache de terceiros na mesma origem não é
            // nossa conta.
            .filter(function (nome) {
              return nome.indexOf(PREFIXO_CACHE) === 0 && nome !== CACHE;
            })
            .map(function (nome) {
              return caches.delete(nome);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

// Sem `skipWaiting`: a versão nova espera as abas atuais fecharem.
//
// Com skipWaiting o SW novo assume na hora e apaga o cache antigo debaixo de
// uma aba que ainda está rodando o build anterior — a próxima navegação dela
// pede um chunk que já não existe nem no cache nem no servidor, e a tela quebra.
// A navegação abaixo é network-first, então quem recarrega depois do deploy já
// recebe o HTML novo mesmo com o SW velho ativo; o cache só serve offline.

self.addEventListener("fetch", function (evento) {
  const req = evento.request;

  // Navegação: rede primeiro, cache como rede de segurança. O contrário serviria
  // a versão anterior da tela mesmo com internet boa.
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req).catch(function () {
        // A própria página, se já foi visitada, vem antes da tela de offline:
        // quem já abriu o painel continua vendo o painel sem rede, e o aviso
        // genérico fica para quem pede uma rota que nunca carregou (#322).
        return caches.match(req).then(function (hit) {
          return hit || caches.match("/offline");
        });
      })
    );
    return;
  }

  // Sem respondWith, a requisição segue para a rede como se o SW não existisse.
  // É o caminho de tudo que é autenticado ou de API.
  if (!podeCachear(req, self.location.origin)) return;

  // Asset estático: cache primeiro. Os nomes do /_next/static têm hash, então
  // uma entrada em cache nunca fica obsoleta — muda o nome, muda a chave.
  evento.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (resposta) {
        if (resposta && resposta.ok && resposta.type === "basic") {
          const copia = resposta.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(req, copia);
          });
        }
        return resposta;
      });
    })
  );
});
