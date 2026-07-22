import { API_BASE } from "./api";

/**
 * Decide para onde mandar o usuário logo após o login. Quem não tem nenhuma
 * organização (típico do primeiro login por Google) vai para o onboarding
 * criar a sua; os demais vão direto ao dashboard (#207).
 */
export async function nextRouteAfterLogin(token: string): Promise<string> {
  try {
    const r = await fetch(`${API_BASE}/api/v1/me/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return "/dashboard";
    const d = await r.json();
    const orgs = d?.organizations ?? [];
    return orgs.length === 0 ? "/onboarding" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
