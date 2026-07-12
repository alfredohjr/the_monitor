// Cliente HTTP central. Injeta o token e a organização ativa (X-Org-Id) em
// toda requisição de dados, para não repetir essa montagem em cada componente
// nem deixar essa regra espalhada pelo front.

export const API_BASE = "http://localhost:8000";

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
