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

// Cache das leituras da API (#325). Nome SEM a versão do app, de propósito: ele
// guarda dado do usuário, não build, e apagá-lo a cada deploy jogaria fora
// justamente o que faz o app abrir com conteúdo na tela.
const PREFIXO_CACHE_API = "themonitor-api";
const CACHE_API = PREFIXO_CACHE_API;
const PREFIXO_API = "/api/v1/";

function podeCachearApi(req, origem) {
  if (req.method !== "GET") return false;
  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return false;
  }
  if (url.origin !== origem) return false;
  return url.pathname.indexOf(PREFIXO_API) === 0;
}

// Espelho de `digest` em src/lib/sw-cache.ts — ver a nota no topo do arquivo.
function digestChave(texto) {
  const passada = function (entrada) {
    let h = 0x811c9dc5;
    for (let i = 0; i < entrada.length; i++) {
      h ^= entrada.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return passada(texto) + passada(texto.split("").reverse().join(""));
}

// A identidade entra na CHAVE porque a Cache API indexa só por URL e ignora os
// headers. Sem isso, duas organizações compartilhariam a mesma entrada.
function chaveDeCacheApi(req) {
  const url = new URL(req.url);
  const auth = req.headers.get("Authorization");
  const org = req.headers.get("X-Org-Id") || "sem-org";
  const usuario = auth ? "u" + digestChave(auth) : "anon";
  return url.origin + "/__api-cache/" + usuario + "-o" + org + url.pathname + url.search;
}

function respostaCacheavel(resposta) {
  return !!resposta && resposta.ok && resposta.status > 0;
}

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

  // Leitura da API: stale-while-revalidate (#325). Devolve na hora o que já se
  // sabe e busca o atual em segundo plano, para o app abrir com dado na tela em
  // vez de spinner.
  if (podeCachearApi(req, self.location.origin)) {
    evento.respondWith(
      caches.open(CACHE_API).then(function (cache) {
        const chave = chaveDeCacheApi(req);
        return cache.match(chave).then(function (hit) {
          const daRede = fetch(req)
            .then(function (resposta) {
              // Erro NUNCA entra: um 401 guardado seria servido depois do login
              // e diria "sessão expirada" para quem acabou de entrar.
              if (respostaCacheavel(resposta)) cache.put(chave, resposta.clone());
              return resposta;
            })
            .catch(function (erro) {
              // Offline: o que estava em cache já foi devolvido abaixo. Sem
              // nada em cache, o erro precisa chegar ao app.
              if (hit) return hit;
              throw erro;
            });

          // waitUntil mantém o SW vivo até a revalidação terminar; sem isso o
          // navegador pode encerrá-lo assim que a resposta em cache é entregue,
          // e o cache nunca se atualizaria.
          if (hit) evento.waitUntil(daRede.catch(function () {}));
          return hit || daRede;
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

// ---------------------------------------------------------------------------
// Web Push (#328)
// ---------------------------------------------------------------------------

self.addEventListener("push", function (evento) {
  // Payload malformado não pode impedir a notificação: sem `showNotification`
  // o Chrome mostra "Este site foi atualizado em segundo plano", que é pior do
  // que um título genérico.
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (e) {
    dados = {};
  }

  evento.waitUntil(
    self.registration.showNotification(dados.title || "themonitor", {
      body: dados.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // A rota viaja no `data` porque o clique é tratado noutro handler, quando
      // o payload original já não existe mais.
      data: { url: dados.url || "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", function (evento) {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || "/notifications";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (janelas) {
      // Foca uma janela já aberta em vez de abrir outra: sem isto, cada
      // notificação clicada deixa mais uma aba do app para trás.
      for (let i = 0; i < janelas.length; i++) {
        if (janelas[i].url.indexOf(url) !== -1 && "focus" in janelas[i]) return janelas[i].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
