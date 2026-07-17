// Cliente HTTP central. Injeta o token e a organização ativa (X-Org-Id) em
// toda requisição de dados, para não repetir essa montagem em cada componente
// nem deixar essa regra espalhada pelo front.

// Base da API. Em produção o front é servido no mesmo domínio e o proxy (Caddy)
// roteia /api/* pro backend — então NEXT_PUBLIC_API_BASE="" faz as chamadas
// ficarem same-origin (/api/v1/...). Sem env (dev/testes) cai em localhost:8000.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type ErroPydantic = { loc?: unknown[]; msg?: string };

// Normaliza o `detail` de um erro da API para texto exibível.
// O FastAPI manda `detail` como string nos erros nossos (400/403), mas o 422 de
// validação do pydantic manda uma LISTA de objetos — jogar isso direto na tela
// vira "[object Object]", e num setState do React quebra a renderização. As
// mensagens do pydantic são em inglês, então traduzimos o caso que os formulários
// realmente produzem (e-mail malformado) e caímos num genérico no resto.
export function mensagemDeErro(detail: unknown, fallback = "Erro inesperado"): string {
  if (typeof detail === "string" && detail) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const erros = detail as ErroPydantic[];
    const temEmail = erros.some((e) => Array.isArray(e?.loc) && e.loc.includes("email"));
    return temEmail ? "E-mail inválido." : "Confira os dados do formulário.";
  }

  return fallback;
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
 * fetch com Authorization + X-Org-Id automáticos.
 * `path` pode ser relativo ("/api/v1/...") ou absoluto.
 */
export function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const org = getActiveOrg();
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> | undefined) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (org != null) headers["X-Org-Id"] = String(org);
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  return fetch(url, { ...opts, headers });
}
