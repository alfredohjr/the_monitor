// Assinatura de push no navegador (#328).
//
// A chave VAPID pública é `NEXT_PUBLIC_*`, ou seja, INLINADA EM BUILD TIME.
// Ela precisa entrar como build-arg no CI, como o Client ID do Google
// (#202/#203) — mudar o .env do servidor não tem efeito nenhum. Sem a chave,
// `ativarPush` devolve "indisponivel" em vez de estourar num ponto distante.

import { apiFetch } from "./api";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export type ResultadoAtivacao = "ok" | "negada" | "indisponivel" | "erro";

/**
 * base64url → bytes.
 *
 * O `applicationServerKey` exige `Uint8Array`; string crua é recusada. E a
 * chave vem em base64**url**, que troca `+/` por `-_` e omite o padding — jogar
 * isso no `atob` levanta InvalidCharacterError, um erro que não menciona VAPID
 * nem push e manda procurar no lugar errado.
 */
export function base64UrlParaUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64);
  // Alocado a partir de um ArrayBuffer explícito: `new Uint8Array(n)` produz
  // `Uint8Array<ArrayBufferLike>`, que o TS não aceita como `BufferSource` do
  // `applicationServerKey`. O jest transpila sem checar tipo — quem pegou isso
  // foi o `npm run build`.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

/** O navegador tem tudo que o push exige? */
export function pushSuportado(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Permissão atual, sem pedir nada. */
export function permissaoAtual(): NotificationPermission | "unsupported" {
  if (!pushSuportado()) return "unsupported";
  return Notification.permission;
}

/**
 * Pede permissão, assina e registra no backend.
 *
 * **Chame isto a partir de um clique**, nunca no carregamento da tela: fora de
 * um gesto do usuário o navegador tende a negar, e "bloqueado" fica gravado
 * para sempre — não há como reabrir a pergunta por código.
 */
export async function ativarPush(chave: string = VAPID_PUBLIC_KEY): Promise<ResultadoAtivacao> {
  if (!pushSuportado()) return "indisponivel";
  // Build sem o build-arg: melhor dizer "indisponível" do que falhar depois na
  // conversão da chave, longe da causa.
  if (!chave) return "indisponivel";

  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") return "negada";

    const registro = await navigator.serviceWorker.ready;
    const inscricao = await registro.pushManager.subscribe({
      // Sem isto o Chrome recusa a inscrição: ele exige o compromisso de que
      // todo push vira notificação visível.
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaUint8Array(chave),
    });

    // O navegador entrega as chaves aninhadas em `keys`; o backend (#326) espera
    // plano. Sem o achatamento, p256dh e auth chegam indefinidos e o erro só
    // aparece muito depois, na criptografia do envio.
    const json = inscricao.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    await apiFetch("/api/v1/push/subscribe/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        platform: "web",
      }),
    });

    return "ok";
  } catch {
    // Push é um extra: nada aqui pode derrubar a tela de notificações.
    return "erro";
  }
}

/**
 * Cancela a inscrição.
 *
 * Avisa o backend ANTES de cancelar no navegador. Na ordem inversa, uma falha
 * de rede deixaria o backend com um endpoint que já não existe — embora isso se
 * resolvesse sozinho, já que o envio (#327) apaga inscrição que responde 410.
 */
export async function desativarPush(): Promise<void> {
  if (!pushSuportado()) return;

  try {
    const registro = await navigator.serviceWorker.ready;
    const inscricao = await registro.pushManager.getSubscription();
    if (!inscricao) return;

    await apiFetch("/api/v1/push/subscribe/", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: inscricao.endpoint }),
    });
    await inscricao.unsubscribe();
  } catch {
    // idem: desativar nunca quebra a tela
  }
}
