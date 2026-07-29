// Catálogo da tela de login.
export const login = {
  title: "Restricted Access",
  subtitle: "Enter your credentials to continue.",
  usernameLabel: "Username",
  // O placeholder é um exemplo de nome próprio; em inglês vira um nome comum
  // em vez de "Ex: alfredo", que só faz sentido para quem conhece o dono do repo.
  usernamePlaceholder: "e.g. alex",
  passwordLabel: "Password",
  submit: "Sign in to the system",
  submitting: "Signing in…",
  forgotPassword: "I forgot my password",
  or: "or",
  googleUnavailable: "Google sign-in unavailable (set NEXT_PUBLIC_GOOGLE_CLIENT_ID)",
  noAccount: "Don't have an account?",
  createAccount: "Create account",
  // Erros exibidos na própria tela. Os que vêm do backend continuam chegando
  // pelo `detail` da API e são traduzidos lá (#300).
  googleFailed: "Could not sign in with Google",
  invalidCredentials: "Invalid credentials or server error",
  loginFailed: "Could not complete the sign-in",
};
