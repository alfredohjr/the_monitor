import { API_BASE } from "./api";
export interface AuthTokens {
  access: string;
  refresh: string;
  username: string;
}

const DEFAULT_API_BASE = API_BASE + "";

/**
 * Troca um ID token do Google (credential) pelos nossos tokens de acesso,
 * chamando o endpoint do backend `/api/v1/auth/google/` (issue #16).
 */
export async function exchangeGoogleCredential(
  credential: string,
  apiBase: string = DEFAULT_API_BASE,
): Promise<AuthTokens> {
  const res = await fetch(`${apiBase}/api/v1/auth/google/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) throw new Error("Falha no login com Google");
  return res.json();
}
