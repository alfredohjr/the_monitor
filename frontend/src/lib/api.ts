// Cliente HTTP central. Injeta o token e a organização ativa (X-Org-Id) em
// toda requisição de dados, para não repetir essa montagem em cada componente
// nem deixar essa regra espalhada pelo front.

// Base da API. Em produção o front é servido no mesmo domínio e o proxy (Caddy)
// roteia /api/* pro backend — então NEXT_PUBLIC_API_BASE="" faz as chamadas
// ficarem same-origin (/api/v1/...). Sem env (dev/testes) cai em localhost:8000.
import { getInitialLocale, t } from "./i18n";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type ErroPydantic = { loc?: unknown[]; msg?: string };

// Normaliza o `detail` de um erro da API para texto exibível.
// O FastAPI manda `detail` como string nos erros nossos (400/403) — e desde o
// #300-#302 essa string já vem no idioma pedido pelo Accept-Language. O 422 de
// validação do pydantic manda uma LISTA de objetos, sempre em inglês: jogar isso
// direto na tela vira "[object Object]" e num setState do React quebra a
// renderização, então traduzimos aqui o caso que os formulários produzem.
//
// `fallback` é opcional (não tem valor default) de propósito: um default como
// `= t("comum.unexpectedError")` seria avaliado no CARREGAMENTO do módulo e
// congelaria o idioma daquele instante — trocar de idioma não teria efeito.
export function mensagemDeErro(detail: unknown, fallback?: string): string {
  if (typeof detail === "string" && detail) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const erros = detail as ErroPydantic[];
    const temEmail = erros.some((e) => Array.isArray(e?.loc) && e.loc.includes("email"));
    return t(temEmail ? "comum.invalidEmail" : "comum.checkFormData");
  }

  return fallback ?? t("comum.unexpectedError");
}

const ACTIVE_ORG_KEY = "active_org_id";

export function getActiveOrg(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ACTIVE_ORG_KEY);
  return raw ? Number(raw) : null;
}

export function setActiveOrg(id: number): void {
  if (typeof window !== "undefined") localStorage.setItem(ACTIVE_ORG_KEY, String(id));
}

export function clearActiveOrg(): void {
  if (typeof window !== "undefined") localStorage.removeItem(ACTIVE_ORG_KEY);
}

/**
 * fetch com Authorization, X-Org-Id e Accept-Language automáticos.
 * `path` pode ser relativo ("/api/v1/...") ou absoluto.
 */
export function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const org = getActiveOrg();
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> | undefined) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (org != null) headers["X-Org-Id"] = String(org);
  // Idioma da requisição: o backend responde os erros nele (#299-#302). Um
  // header explícito do chamador vence — quem passou sabe o que quer.
  if (!headers["Accept-Language"]) headers["Accept-Language"] = getInitialLocale();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  return fetch(url, { ...opts, headers });
}
