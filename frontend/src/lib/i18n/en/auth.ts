// Catálogo dos fluxos de recuperação de senha e verificação de e-mail:
// ForgotPassword, ResetPassword e VerifyEmail.
export const auth = {
  // --- Esqueci minha senha ---
  forgotTitle: "I forgot my password",
  forgotSubtitle: "Enter your email to receive the reset link.",
  emailPlaceholder: "you@email.com",
  sendLink: "Send link",
  sending: "Sending…",
  // Deliberadamente vago sobre o e-mail existir: dizer "não encontrado"
  // entregaria quais endereços estão cadastrados.
  forgotSent:
    "If the email is registered, we sent a link to reset the password. Check your inbox.",
  backToLogin: "Back to sign-in",

  // --- Redefinir senha ---
  resetTitle: "Reset password",
  newPasswordPlaceholder: "New password",
  confirmPasswordPlaceholder: "Confirm new password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  resetSubmit: "Reset password",
  resetting: "Resetting…",
  resetDone: "Password reset! Redirecting to sign-in…",
  missingToken: "Invalid link: missing token.",
  passwordTooShort: "The password must be at least 6 characters long.",
  passwordsDoNotMatch: "Passwords do not match.",
  resetExpired: "Could not reset the password. The link may have expired.",
  resetFailed: "Could not reset the password.",

  // --- Confirmação de e-mail ---
  verifying: "Verifying your email…",
  verifyTitle: "Email confirmation",
  verifyOk: "Email verified! You can sign in now.",
  verifyFailed: "Could not verify the email.",
  goToLogin: "Go to sign-in",
  backToRegister: "Back to sign-up",
};
