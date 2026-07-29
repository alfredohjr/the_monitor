// Catálogo da tela de cadastro.
export const register = {
  title: "Create Account",
  subtitle: "Fill in your details to sign up.",
  usernameLabel: "Username",
  usernamePlaceholder: "e.g. alex",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  organizationLabel: "Organization",
  organizationPlaceholder: "e.g. My Company",
  organizationHint:
    "If the organization does not exist yet, you create it and become its admin. If it already exists, enter the access code to join.",
  orgCodeLabel: "Organization code",
  orgCodePlaceholder: "Set one (new org) or enter it (existing org)",
  passwordLabel: "Password",
  confirmPasswordLabel: "Confirm Password",
  showPassword: "Show password",
  hidePassword: "Hide password",
  submit: "Create Account",
  submitting: "Creating account…",
  haveAccount: "Already have an account?",
  signIn: "Sign in",
  // Mensagens da própria tela. As do backend chegam pelo `detail` (#300).
  passwordsDoNotMatch: "Passwords do not match",
  createAccountError: "Could not create the account",
  createAccountFailed: "Account creation failed",
  emailConfirmationSent:
    "Account created! We sent a confirmation link to your email. Please verify it before signing in.",
};
