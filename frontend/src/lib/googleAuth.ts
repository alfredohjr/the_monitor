import { API_BASE } from "./api";
export interface AuthTokens {
  access: string;
  refresh: string;
  username: string;
}

const DEFAULT_API_BASE = API_BASE + "";

// Opções de renderização do botão oficial do Google (#220). O botão vem do SDK
// (não dá pra estilizar por CSS), mas dá pra deixá-lo com a cara escura do site:
// tema preenchido escuro, formato pill (arredondado como os botões do site) e
// texto "continue_with". Largura casa com os inputs do formulário de login.
export const googleButtonOptions = {
  theme: "filled_black",
  size: "large",
  shape: "pill",
  text: "continue_with",
  logo_alignment: "left",
  width: 320,
} as const;

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
